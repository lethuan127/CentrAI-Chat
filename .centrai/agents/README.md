# Agent definitions (Markdown)

Declarative agent files for **`cmd/centrai -agent`**: one **Markdown** file per agent, with **YAML front matter** (same schema as legacy YAML-only files).

## Where `instructions` lives

Either:

1. **`instructions:` in front matter** — block scalar (`|`) with the full system prompt before the closing `---`, or  
2. **Markdown body after the closing `---`** — omit `instructions` in YAML; the runtime uses the body as the system prompt (see [example.md](example.md) and [security-reviewer.md](security-reviewer.md)).

If both are present, the body is **appended** to `instructions`.

## Layout (file-based agents)

| Field | Required | Description |
|-------|----------|-------------|
| `name` | no | Short id for logging. |
| `description` | no | Prepended before `instructions` in the system prompt when non-empty. |
| `tools` | no | List of tool **bundles** (e.g. `demo` → `echo` + `add` in `cmd/centrai`). |
| `mcpServers` | no | MCP server **ids** (e.g. keys matching [`.mcp.json`](../../.mcp.json)). Hosts wire tools with `internal/mcp.RegisterRemoteTools`. |
| `mcpServerInstruction` | no | Optional block: `allow: true` / `false` — whether to **append** declared `mcpServers` ids to the system message. Omitted defaults to **allow** (same as before). Set `allow: false` to keep MCP wiring host-only without listing ids in the prompt. |
| `maxTurns` | no | Max model rounds per user turn (> 0). |
| `skills` | no | Skill ids or paths for a future loader; listed in the system prompt; Go skill loader is [roadmap](../../docs/7.%20skills.md). |
| `provider` | no | LLM vendor / routing hint (e.g. `openai`). CLI still uses an OpenAI-compatible HTTP client; other values log a warning. Included in the system prompt when set. |
| `model` | no | Chat model id (e.g. `gpt-4o-mini`). |
| `version` | yes | Must be `1`. |
| `kind` | no | If set, must be `Agent`. |
| `instructions` | yes* | System prompt. *In front matter (`instructions: \|`) **or** Markdown body after `---`.* |
| `metadata` | no | Arbitrary string map for hosts or tooling. |

Use YAML **sequences** for list fields (`tools`, `mcpServers`, `skills`)—e.g. `- demo` or `[demo]`—not a single comma-separated scalar string.

## Example

See [example.md](example.md).

## CLI

From the **repository root**, you can pass a **short id** (loads `.centrai/agents/<id>.md`, `.yaml`, or `.yml` if present) or a full path:

```bash
go run ./cmd/centrai -agent example -repl
go run ./cmd/centrai -agent .centrai/agents/example.md -repl
```

Use `-message "..."` instead of `-repl` for a single turn.

## Legacy

Pure **`.yaml` / `.yml`** files without front matter are still supported by `agentdef.LoadFile`.
