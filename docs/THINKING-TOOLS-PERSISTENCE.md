# Thinking & Tool Message Persistence

> **Status**: Design doc — implement in order (Schema → Service → Controller → Frontend).

## 1. Problem Statement

The current `Message` model only stores plain text assistant replies (`role: ASSISTANT`, `content: string`). The AI SDK v6 streaming pipeline already delivers richer structured data in `responseMessage.parts`:

| Part type | What it carries | Currently persisted? |
|---|---|---|
| `text` | Assistant prose | ✅ yes |
| `reasoning` | Model chain-of-thought (thinking) | ❌ no |
| `tool-invocation` (state `result`) | Tool name + args + output in one part | ❌ no |

Without persistence, tool execution history and reasoning traces are lost after the stream ends. They cannot be replayed for debugging, audit, or re-hydrating context on a page reload.

---

## 2. Data Model

### 2.1 Updated `MessageRole` values

```prisma
enum MessageRole {
  USER        // message authored by the human
  ASSISTANT   // message authored by the model (text or reasoning)
  SYSTEM      // injected system/context message
  TOOL        // tool invocation call or tool result
}
```

`TOOL` represents a single tool invocation. Both the input args and the returned output are stored **on the same row** — `toolArgs` for the call side, `toolResult` for the result side.

#### 2.1.1 New `ContentType` enum

```prisma
enum ContentType {
  TEXT        // plain prose — default for USER / ASSISTANT / SYSTEM rows
  THINKING    // model chain-of-thought / reasoning block (ASSISTANT rows)
  TOOL_CALL   // one complete tool invocation: args + result in a single row (TOOL rows)
}
```

**Role × ContentType matrix:**

| `MessageRole` | `ContentType` | What it represents |
|---|---|---|
| `USER` | `TEXT` | User's chat message |
| `ASSISTANT` | `TEXT` | Model's prose response |
| `ASSISTANT` | `THINKING` | Model chain-of-thought (reasoning block) |
| `SYSTEM` | `TEXT` | System / context injection |
| `TOOL` | `TOOL_CALL` | One tool invocation — `toolArgs` holds input, `toolResult` holds output |

### 2.2 New columns on `Message`

```prisma
model Message {
  // --- existing ---
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(...)
  userId         String?
  user           User?        @relation(...)
  role           MessageRole
  content        String       @db.Text   // primary text; empty string for TOOL_CALL rows
  tokenCount     Int?
  inputTokens    Int?
  outputTokens   Int?
  createdAt      DateTime     @default(now())
  parentId       String?      @map("parent_id")
  parent         Message?     @relation("MessageThread", ...)
  children       Message[]    @relation("MessageThread")
  activeLeafFor  Conversation[] @relation("ConversationActiveLeaf")

  // --- NEW ---
  contentType    ContentType  @default(TEXT) @map("content_type")
  toolCallId     String?   @map("tool_call_id")   // AI SDK toolCallId for correlation across steps
  toolName       String?   @map("tool_name")       // name of the invoked tool
  toolArgs       Json?     @map("tool_args")        // input args from the assistant
  toolResult     Json?     @map("tool_result")      // output returned by the tool
  toolProgress   Json?     @map("tool_progress")    // [] of progress events [{label, pct, ts}]
  durationMs     Int?      @map("duration_ms")      // wall-clock time from invocation to result

  @@index([conversationId])
  @@index([toolCallId])
  @@index([contentType])
  @@map("messages")
}
```

> **Why one row per tool invocation?**
> - `toolArgs` and `toolResult` live on the same row — no separate call/result children to join.
> - Multiple tool calls in one assistant step are siblings under the same ASSISTANT parent row.
> - `toolCallId` is the AI SDK correlation id, useful for matching live-stream parts to persisted rows.
> - Fits the existing tree model used for conversation branching.

### 2.3 Prisma migration

```bash
# From apps/api
npx prisma migrate dev --name add_message_content_type_and_tool_fields
```

---

## 3. Detection Layer

### 3.1 Where to detect

All detection happens inside `ChatController.sendMessage` → `createUIMessageStream` → **`onFinish({ responseMessage })`**.

`responseMessage` is a fully-assembled `UIMessage`; its `parts` array contains all chunks merged by `createUIMessageStream`.

### 3.2 AI SDK v6 part types reference

```ts
type Part =
  | { type: 'text';           text: string }
  | { type: 'reasoning';      reasoning: string }   // thinking
  | { type: 'tool-invocation'; toolCallId: string; toolName: string; args: unknown; state: 'call' | 'partial-call' | 'result'; result?: unknown }
```

Progress events are **not** a native AI SDK part type. They arrive as `data-*` custom stream parts. See §3.4.

### 3.3 Extracting structured parts

Create a new helper `extractMessageParts`:

```ts
// apps/api/src/chat/message-parts.ts

import type { UIMessage } from 'ai';

export interface ExtractedThinking {
  reasoning: string;
}

export interface ExtractedToolInvocation {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result: unknown;
}

export interface ExtractedParts {
  text: string;
  thinking: ExtractedThinking[];
  toolInvocations: ExtractedToolInvocation[];
}

export function extractMessageParts(message: UIMessage): ExtractedParts {
  const text: string[] = [];
  const thinking: ExtractedThinking[] = [];
  const toolInvocations: ExtractedToolInvocation[] = [];

  if (message.role !== 'assistant') {
    return { text: '', thinking: [], toolInvocations: [] };
  }

  for (const part of message.parts ?? []) {
    if (part.type === 'text') {
      text.push(part.text);
    } else if (part.type === 'reasoning') {
      thinking.push({ reasoning: part.reasoning });
    } else if (part.type === 'tool-invocation' && part.state === 'result') {
      // At onFinish all tool calls have reached state 'result' — args + result are both present.
      toolInvocations.push({
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.args,
        result: part.result,
      });
    }
  }

  return {
    text: text.join(''),
    thinking,
    toolInvocations,
  };
}
```

### 3.4 Tool progress events

Mastra can emit custom data chunks via `writer.write({ type: 'data-toolProgress', data: {...} })` in a custom `execute` callback. To capture progress server-side:

**Option A — Intercept in `execute` callback (preferred)**

```ts
// Collect progress events per toolCallId during the stream
const progressMap = new Map<string, Array<{ label: string; pct: number; ts: number }>>();

const stream = createUIMessageStream({
  originalMessages: uiMessages,
  execute: async ({ writer }) => {
    // Tap progress events by wrapping sdkUiStream through a TransformStream
    const progressTap = new TransformStream({
      transform(chunk, controller) {
        if (chunk?.type === 'data-toolProgress') {
          const { toolCallId, label, pct } = chunk.data;
          const events = progressMap.get(toolCallId) ?? [];
          events.push({ label, pct, ts: Date.now() });
          progressMap.set(toolCallId, events);
        }
        controller.enqueue(chunk);
      },
    });

    writer.merge(
      (sdkUiStream as ReadableStream<unknown>).pipeThrough(progressTap)
    );
  },
  onFinish: async ({ responseMessage }) => {
    // progressMap is available here
    await persistAllParts(responseMessage, progressMap);
  },
});
```

**Option B — Post-hoc from `mastraOutput` steps**

`mastraOutput` exposes `steps` (an async iterable or array of `MastraStep`). Each step has `toolResults` with timing. This is simpler but loses live progress granularity — only final call/result pairs are available.

```ts
const steps = await mastraOutput.steps; // Array<MastraStep>
// Each step: { toolCalls: [...], toolResults: [...] }
```

Use **Option B** as the baseline (it requires no custom transform); add **Option A** only when fine-grained progress UI is needed.

---

## 4. Persistence Layer

### 4.1 New `ChatService` methods

```ts
// chat.service.ts

/**
 * Persists a THINKING message (ASSISTANT role, ContentType.THINKING)
 * as a child of the ASSISTANT prose row.
 */
async persistThinkingMessage(
  conversationId: string,
  reasoning: string,
  parentAssistantMessageId: string,
): Promise<MessageRow> {
  return this.prisma.message.create({
    data: {
      conversationId,
      role: MessageRole.ASSISTANT,
      contentType: ContentType.THINKING,
      content: reasoning,
      parentId: parentAssistantMessageId,
    },
  });
}

/**
 * Persists a single TOOL_CALL message (TOOL role, ContentType.TOOL_CALL).
 * Both the invocation args and the returned result are stored on the same row.
 */
async persistToolMessage(
  conversationId: string,
  parentAssistantMessageId: string,
  toolCallId: string,
  toolName: string,
  toolArgs: unknown,
  toolResult: unknown,
  progress?: Array<{ label: string; pct: number; ts: number }>,
  durationMs?: number,
): Promise<MessageRow> {
  return this.prisma.message.create({
    data: {
      conversationId,
      role: MessageRole.TOOL,
      contentType: ContentType.TOOL_CALL,
      content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
      parentId: parentAssistantMessageId,
      toolCallId,
      toolName,
      toolArgs: toolArgs as Prisma.InputJsonValue,
      toolResult: toolResult as Prisma.InputJsonValue,
      toolProgress: progress ? (progress as Prisma.InputJsonValue) : undefined,
      durationMs,
    },
  });
}
```

### 4.2 Orchestration helper

Add a private helper in the controller (or extract to a separate file `persist-message-parts.ts`):

```ts
private async persistMessageParts(
  convId: string,
  assistantMessageId: string,
  parts: ExtractedParts,
  progressMap: Map<string, Array<{ label: string; pct: number; ts: number }>>,
  stepsTimings: Map<string, { startedAt: number; finishedAt: number }>,
) {
  // 1. Persist thinking blocks (in order)
  for (const t of parts.thinking) {
    await this.chatService.persistThinkingMessage(convId, t.reasoning, assistantMessageId);
  }

  // 2. Persist each tool invocation as a single row (args + result together)
  for (const inv of parts.toolInvocations) {
    const timing = stepsTimings.get(inv.toolCallId);
    const durationMs = timing ? timing.finishedAt - timing.startedAt : undefined;

    await this.chatService.persistToolMessage(
      convId,
      assistantMessageId,
      inv.toolCallId,
      inv.toolName,
      inv.args,
      inv.result,
      progressMap.get(inv.toolCallId),
      durationMs,
    );
  }
}
```

---

## 5. Controller Changes

### 5.1 Updated `onFinish` in `sendMessage`

Replace the current `onFinish` body in `chat.controller.ts`:

```ts
// Before stream is created, initialise collectors:
const progressMap = new Map<string, Array<{ label: string; pct: number; ts: number }>>();

// In createUIMessageStream:
onFinish: async ({ responseMessage }) => {
  try {
    const parts = extractMessageParts(responseMessage);
    const clientDisconnected = abortController.signal.aborted;
    if (clientDisconnected && parts.text.length === 0 && parts.toolInvocations.length === 0) {
      return;
    }

    // Token usage
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    try {
      const usage = await mastraOutput.totalUsage;
      inputTokens  = usage?.inputTokens  ?? undefined;
      outputTokens = usage?.outputTokens ?? undefined;
    } catch { /* aborted */ }
    const tokenCount =
      inputTokens != null && outputTokens != null
        ? inputTokens + outputTokens
        : undefined;

    // Persist main assistant message (text only)
    let assistantMessageId: string;
    if (assistantPersist.mode === 'update') {
      await this.chatService.updateAssistantMessage(
        assistantPersist.assistantMessageId,
        convId,
        parts.text,
        tokenCount,
        inputTokens,
        outputTokens,
      );
      assistantMessageId = assistantPersist.assistantMessageId;
    } else {
      const row = await this.chatService.persistAssistantMessage(
        convId,
        parts.text,
        assistantPersist.parentUserMessageId,
        tokenCount,
        inputTokens,
        outputTokens,
      );
      assistantMessageId = row.id;
    }

    // Persist thinking + tool sub-messages
    await this.persistMessageParts(
      convId,
      assistantMessageId,
      parts,
      progressMap,
      new Map(), // step timings — wire from mastraOutput.steps if needed
    );

    if (isNew) {
      this.chatService.generateTitleAsync(convId);
    }
  } catch (err) {
    this.logger.error('Failed to persist message parts after UI stream finished', err);
  }
},
```

> **Note**: `persistAssistantMessage` currently returns `void`. Update it to `Promise<MessageRow>` so the id is available for child rows.

---

## 6. Message Tree After a Tool Turn

For a single turn where the model thinks then calls one tool:

```
CONVERSATION
└── USER message             (role: USER,      contentType: TEXT)
    └── ASSISTANT message    (role: ASSISTANT,  contentType: TEXT, tokenCount)
        ├── THINKING message (role: ASSISTANT,  contentType: THINKING, content = reasoning text)
        └── TOOL message     (role: TOOL,       contentType: TOOL_CALL,
                              toolName, toolArgs, toolResult, toolProgress[], durationMs)
        (additional TOOL siblings for multi-step tool calls)
```

Each `TOOL` row is a **sibling** of `THINKING`, not a parent-child pair. Both `toolArgs` and `toolResult` live on the same row.

All child rows share `conversationId` and point to their logical parent via `parentId`. They do **not** appear in the "active branch" transcript query (which filters on `role IN (USER, ASSISTANT)` and `contentType = TEXT`) unless the caller opts in via `includeToolMessages=true`.

---

## 7. API / Query Impact

### 7.1 `getMessages` — transcript endpoint

The existing branch-walk query filters on `role IN (USER, ASSISTANT)` and `contentType = TEXT` to return only the readable conversation turns — this preserves backward compatibility with the chat UI.

Add an `includeToolMessages` query parameter (default `false`):

```ts
// conversationQuerySchema addition
includeToolMessages: z.boolean().optional().default(false)
```

When `true`, return the full subtree including rows where `contentType` is `THINKING` or `TOOL_CALL` (useful for debug / audit panels).

### 7.2 `exportConversation`

Markdown export should render tool calls inline under their assistant turn:

```markdown
**Assistant**: Let me check the weather.

> 🔧 **Tool: get_weather** (`{"city":"Hanoi"}`)
> Result: `{"temp":34,"condition":"sunny"}`

The weather in Hanoi is 34°C and sunny.
```

---

## 8. Frontend Impact

### 8.1 Live stream (already works)

The AI SDK v6 client (`useChat`) already renders `tool-invocation` and `reasoning` parts in real-time via `message.parts`. No stream changes needed.

### 8.2 Page reload / history hydration

Currently `GET /chat/conversations/:id/messages` returns only USER + ASSISTANT rows, so tool steps disappear on reload. To fix:

1. Fetch tool sub-messages alongside the assistant row (new `includeToolMessages=true` param, or embed as `parts` field on the assistant row).
2. Reconstruct `UIMessage.parts` from DB rows before passing to `useChat` initial state.

**Recommended shape for the reconstructed assistant `UIMessage`**:

```ts
// Reconstruct from DB rows in the frontend API layer
const parts: UIMessagePart[] = [
  ...thinkingRows.map(r => ({ type: 'reasoning', reasoning: r.content })),
  ...toolRows.map(r => ({
    type: 'tool-invocation',
    state: 'result',
    toolCallId: r.toolCallId,
    toolName: r.toolName,
    args: r.toolArgs,
    result: r.toolResult,   // already on the same row
  })),
  { type: 'text', text: assistantRow.content },
];
```

### 8.3 Tool progress display

During streaming, progress events arrive as `data-toolProgress` custom chunks. The UI can subscribe to them via `useChat`'s `onToolCall` callback or a custom `data` handler. No backend change is required for live progress; the persistence side is additive.

---

## 9. Implementation Checklist

### Phase 1 — Schema
- [ ] Add `TOOL` to `MessageRole` enum
- [ ] Add `ContentType` enum with values `TEXT`, `THINKING`, `TOOL_CALL`
- [ ] Add `contentType ContentType @default(TEXT)` column to `Message`
- [ ] Add `toolCallId`, `toolName`, `toolArgs`, `toolResult`, `toolProgress`, `durationMs` columns to `Message`
- [ ] Add `@@index([contentType])` and `@@index([toolCallId])` to `Message`
- [ ] Run `prisma migrate dev`
- [ ] Regenerate Prisma client

### Phase 2 — Service
- [ ] Add `persistThinkingMessage` to `ChatService` (role: ASSISTANT, contentType: THINKING)
- [ ] Add `persistToolMessage` to `ChatService` (role: TOOL, contentType: TOOL_CALL — stores both args + result)
- [ ] Update `persistAssistantMessage` to return `MessageRow` (not `void`)

### Phase 3 — Detection & Controller
- [ ] Create `apps/api/src/chat/message-parts.ts` with `extractMessageParts` (merged `toolInvocations`)
- [ ] Add `persistMessageParts` private helper to `ChatController`
- [ ] Wire `progressMap` collector in `execute` callback
- [ ] Update `onFinish` to call `extractMessageParts` + `persistMessageParts`

### Phase 4 — Query layer
- [ ] Add `includeToolMessages` to `messageQuerySchema` and `getMessages` (filters `contentType IN (THINKING, TOOL_CALL)`)
- [ ] Update `exportConversation` Markdown serializer
- [ ] Update Swagger schemas

### Phase 5 — Frontend
- [ ] Pass `includeToolMessages=true` when fetching history
- [ ] Reconstruct `UIMessage.parts` from DB rows — `toolRows` map directly (args + result on same row)
- [ ] Render thinking blocks (collapsed by default) in `ChatMessageItem` — already wired for live stream
- [ ] Render tool step cards with progress bar in `ChatMessageItem` — already wired for live stream

---

## 10. Open Questions

| # | Question | Recommendation |
|---|---|---|
| 1 | Should THINKING rows count toward `maxTurnsMessageHistory`? | No — only USER + ASSISTANT rows with `contentType = TEXT` count as "turns". |
| 2 | Should tool sub-messages be included in token billing display? | No — token counts are on the ASSISTANT parent row. |
| 3 | Should `toolResult` content be encrypted at rest? | Only if the tool can return PII. Apply field-level encryption in `persistToolMessage`. |
| 4 | Max `toolProgress` array size? | Cap at 100 events per tool call in `persistToolMessage`. |
| 5 | What happens when the stream aborts mid-tool-call? | Persist whatever was received; if `result` is absent set `toolResult: null` and add `{ aborted: true }` to `toolProgress`. |
