# CentrAI Demo MCP Server

A minimal [Model Context Protocol](https://modelcontextprotocol.io/) server that demonstrates the CentrAI-Chat MCP integration end-to-end.

## What it demonstrates

| Feature | How |
|---|---|
| **Server instructions** | Returned in `InitializeResult` — agent picks them up via `serverInstructions: true` |
| **Bearer token auth** | `Authorization: Bearer {{USER_ACCESS_TOKEN}}` resolved from `RequestContext` at call time |
| **Per-user state** | `X-User-ID: {{USER_ID}}` header scopes the in-memory note store per user |
| **Handlebars templates** | Header values use `{{USER_ACCESS_TOKEN}}` / `{{USER_ID}}` — resolved by `mcp-client-adapter.ts` |
| **Streamable HTTP transport** | Stateless `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` |

## Tools

| Tool | Description |
|---|---|
| `get_time` | Returns the current time in any IANA timezone |
| `create_note` | Saves a note for the current user (in memory) |
| `list_notes` | Lists all notes for the current user |
| `delete_note` | Deletes a note by ID |
| `echo` | Echoes a message back with server metadata |

## Quick start

```bash
# From repo root
pnpm install

# Start the demo server (port 8016)
pnpm --filter centrai-demo-mcp-server dev

# With optional auth token
DEMO_TOKEN=secret pnpm --filter centrai-demo-mcp-server dev
```

The server starts at **http://localhost:8016/mcp**.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8016` | HTTP port |
| `DEMO_TOKEN` | _(unset)_ | If set, all requests must supply `Authorization: Bearer <token>`. Leave unset to disable auth. |

## Connecting to CentrAI-Chat

The `.centrai/.mcp.json` at the repo root already includes the `centrai-demo` entry:

```json
{
  "mcpServers": {
    "centrai-demo": {
      "type": "streamable-http",
      "url": "http://localhost:8016/mcp",
      "headers": {
        "Authorization": "Bearer {{USER_ACCESS_TOKEN}}",
        "X-User-ID": "{{USER_ID}}",
        "X-User-Email": "{{USER_EMAIL}}"
      },
      "timeout": 30000,
      "serverInstructions": true,
      "startup": true
    }
  }
}
```

The header values use `{{USER_ACCESS_TOKEN}}` / `{{USER_ID}}` — these are resolved by `buildTemplateData` from the Mastra `RequestContext` on every MCP tool call. See [`docs/MCP.md §9`](../../docs/MCP.md#9-centrai_context_var--predefined-template-variables) for the full list of predefined variables.

### How the API wires the context

In `apps/api`, the chat controller populates the `RequestContext` with the canonical vars before each stream call:

```ts
import { CENTRAI_CONTEXT_VAR } from '@centrai/agent';

await createCentrAiChatStream({
  agent,
  messages,
  requestContext: {
    [CENTRAI_CONTEXT_VAR.USER_ACCESS_TOKEN]: req.user.accessToken,
    [CENTRAI_CONTEXT_VAR.USER_ID]: req.user.id,
    [CENTRAI_CONTEXT_VAR.USER_EMAIL]: req.user.email,
    [CENTRAI_CONTEXT_VAR.CONVERSATION_ID]: conversation.id,
  },
});
```

### Enabling the toolkit

The `AgentModule.onModuleInit` in `apps/api` auto-loads `.centrai/.mcp.json` at startup and registers `mcp:centrai-demo` in the `TOOLKIT_CATALOG`. To attach the toolkit to an agent, add the tool ref in the admin UI or in your seed data:

```json
{ "name": "mcp:centrai-demo" }
```

## Testing without CentrAI-Chat

Use `curl` or the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
# Initialize + call get_time directly
curl -s -X POST http://localhost:8016/mcp \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_time",
      "arguments": { "timezone": "Asia/Tokyo" }
    }
  }'

# Health check
curl http://localhost:8016/health
```

## Architecture

```
Request
  └── Express /mcp
        ├── checkAuth()          — Bearer token validation (optional)
        ├── userId from X-User-ID header
        ├── createServer(userId) — new McpServer per request (stateless)
        │     ├── SERVER_INSTRUCTIONS → InitializeResult.instructions
        │     └── tools: get_time, create_note, list_notes, delete_note, echo
        └── StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
```

State (`notesByUser`) lives at module scope. Per-user notes persist across requests but are lost on server restart.
