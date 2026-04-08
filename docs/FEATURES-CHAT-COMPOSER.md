# Chat composer features — multimodal, web search, and related controls

This document describes **end-user chat composer** capabilities: what the product aims to support, what is implemented today, and what engineering work remains. It aligns with [SCOPE.md](./SCOPE.md) (platform vision) and the chat UI in `apps/web`.

---

## Summary

| Capability | User-facing intent | In v1 / today |
|------------|-------------------|---------------|
| **Text message** | Type a prompt and send | Shipped: streaming chat with published agents or enabled models |
| **File / image attachment (multimodal)** | Add images or files so the model can reason over them | **Not wired:** UI affordances are placeholders; API persists and forwards **text** only |
| **Web search** | Let the assistant use fresh web results (via a tool or provider feature) | **Not implemented** in chat; [SCOPE.md](./SCOPE.md) lists web search as a built-in tool concept for a future tools layer |
| **“Auto” mode** | Automatic routing (e.g. when to search vs answer from context) | **Not implemented** (placeholder label) |
| **Voice input** | Speak instead of type | **Not implemented** (placeholder) |
| **Extra tools / “focus”** | Deeper retrieval or scoped tools | **Not implemented** (placeholders) |

---

## Current implementation (repository facts)

### Chat page (`apps/web`)

- Composer uses **“Ask anything”** placeholder and a rounded bar layout consistent with a multimodal product shell.
- Toolbar controls (**Add**, **Globe / search**, **Image attach**, **Type / style**, **Auto**, **Crosshair**, **Mic**) are **non-functional** and labeled **“coming soon”** in their `title` tooltips.
- Submit handler only sends trimmed **text**; attachment data from the input component is ignored:

```947:951:apps/web/src/app/(dashboard)/chat/page.tsx
  const handlePromptSubmit = (msg: PromptInputMessage) => {
    const trimmed = msg.text.trim();
    if (!trimmed || status !== 'ready') return;
    sendMessage(trimmed);
  };
```

### Shared `PromptInput` (`apps/web/src/components/ai-elements/prompt-input.tsx`)

- The Vercel AI SDK–style `PromptInput` already supports **attachments** in its data model (`PromptInputMessage` includes `text` and `files`), validation (`accept`, `maxFiles`, `maxFileSize`), paste-from-clipboard files, and optional `PromptInputProvider` for lifted state.
- The dashboard chat page does **not** connect the footer icons to `openFileDialog`, `PromptInputActionAddAttachments`, or submission of `msg.files`.

### API (`apps/api`)

- The streaming chat endpoint builds the user turn from **string content** or **text parts** of the last message; there is no first-class handling of image or file parts for provider vision APIs yet.
- Message storage follows the MVP shape (text-oriented); multimodal payloads would need schema and adapter work.

---

## Product documentation (what to tell users)

Use this wording until features ship; then replace “planned” with concrete limits (formats, size caps, provider support).

### Multimodal chat (attachments)

**Planned behavior (target):** End users can attach supported files or images to a message. The platform will send compatible content to the selected model (where the provider and model support vision or documents), show thumbnails or file chips in the thread, and retain enough metadata for history and export.

**Today:** Attachment controls in the composer are **not available**. Chat is **text-only**.

### Web search

**Planned behavior (target):** When enabled for an agent or session, the assistant can call a **web search tool** (or equivalent) so answers can cite recent public information. Scope and safety (domains, rate limits, logging) would be defined in admin configuration.

**Today:** There is **no in-app web search** tied to the globe control. Sidebar **“Search conversations…”** only filters **your past conversations**, not the live web.

### Other composer controls

- **Add (+):** Reserved for a future menu (e.g. attachments, prompts, or actions).
- **Auto:** Reserved for a future mode selector (e.g. automatic tool use).
- **Voice:** Reserved for speech-to-text input.
- **Crosshair / tools:** Reserved for optional tools or focus modes once the tool layer exists.

---

## Implementation checklist (for engineers)

When implementing multimodal chat:

1. **UI:** Wire `PromptInput` attachments (or equivalent) to the composer icons; show chips/previews; include files in `onSubmit`.
2. **Client:** Encode files for transport (e.g. base64 data URLs or upload-then-reference URLs) consistent with the AI SDK message `parts` shape expected by the API.
3. **API:** Accept multimodal user parts; map to provider adapter messages (OpenAI/Anthropic/Gemini vision fields); enforce size/type limits and workspace quotas.
4. **Persistence:** Extend `Message` (or related model) to store part types safely; ensure exports and admin audit views redact or summarize binary metadata appropriately.
5. **RBAC:** End-user endpoints must not expose agent system prompts or admin-only configuration.

When implementing web search:

1. **Tooling:** Implement or integrate a search tool in the agent/tool pipeline ([SCOPE.md](./SCOPE.md) §2.5 Tools).
2. **Chat:** Expose a user-toggle or agent-level flag; stream tool steps if the UI should show “searching…” states.
3. **Compliance:** Document data sent to search providers, retention, and admin controls.

---

## Related documents

- [SCOPE.md](./SCOPE.md) — end-user flows (attachments), built-in tools (web search)
- [MVP.md](./MVP.md) — Phase 3 chat scope (text streaming; multimodal not in MVP table)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — module layout and data flows
