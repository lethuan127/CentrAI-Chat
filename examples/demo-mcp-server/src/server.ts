/**
 * CentrAI Demo MCP Server
 *
 * A minimal Streamable-HTTP MCP server that demonstrates:
 *  - Server instructions returned in the MCP InitializeResult
 *  - Bearer token auth (optional, enable via DEMO_TOKEN env var)
 *  - Per-user state driven by the X-User-ID request header
 *  - Five tools: get_time, create_note, list_notes, delete_note, echo
 *
 * Default URL: http://localhost:8016/mcp
 * Matches the "centrai-demo" entry in .centrai/.mcp.json.
 *
 * Usage:
 *   pnpm dev                         # hot-reload dev mode
 *   PORT=8016 DEMO_TOKEN=secret pnpm dev  # with auth
 */

import express, { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '8016', 10);

/**
 * Server instructions injected into the agent's system prompt when the agent
 * config sets `serverInstructions: true`. Tests the `McpCentrAITools`
 * instruction-loading path in `packages/agent`.
 */
const SERVER_INSTRUCTIONS = `
You have access to the CentrAI demo MCP server (centrai-demo v0.1.0).

It provides the following capabilities:
- Time queries: ask for the current time in any IANA timezone.
- Note management: create, list, and delete short notes. Notes are private to
  the authenticated user and stored in memory (reset on server restart).
- Echo: verify connectivity and inspect request metadata.

When helping users with notes, always confirm the note ID after creation and
mention that notes are ephemeral (lost on server restart).
`.trim();

// ---------------------------------------------------------------------------
// In-memory note store  (userId → noteId → Note)
// ---------------------------------------------------------------------------

interface Note {
  title: string;
  content: string;
  createdAt: string;
}

const notesByUser = new Map<string, Map<string, Note>>();

function getUserNotes(userId: string): Map<string, Note> {
  if (!notesByUser.has(userId)) notesByUser.set(userId, new Map());
  return notesByUser.get(userId)!;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the request is authorized.
 * Auth is disabled when `DEMO_TOKEN` is not set — useful for local dev.
 */
function isAuthorized(req: Request): boolean {
  console.log(req.headers);
  const expected = process.env.DEMO_TOKEN;
  if (!expected) return true;
  return req.headers.authorization === `Bearer ${expected}`;
}

// ---------------------------------------------------------------------------
// MCP server factory
// ---------------------------------------------------------------------------

/**
 * Creates a new `McpServer` instance for each request.
 * Tools close over `userId` extracted from the `X-User-ID` header so that
 * per-user note state works correctly even in stateless transport mode.
 */
function createServer(userId: string): McpServer {
  const mcp = new McpServer(
    { name: 'centrai-demo', version: '0.1.0' },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  // ── get_time ────────────────────────────────────────────────────────────────
  mcp.tool(
    'get_time',
    'Returns the current date and time. Optionally formatted for a specific IANA timezone.',
    {
      timezone: z
        .string()
        .optional()
        .describe('IANA timezone (e.g. "America/New_York", "Asia/Tokyo"). Defaults to UTC.'),
    },
    ({ timezone }) => {
      const tz = timezone ?? 'UTC';
      try {
        const text = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          dateStyle: 'full',
          timeStyle: 'long',
        }).format(new Date());
        return { content: [{ type: 'text', text: `Current time in ${tz}: ${text}` }] };
      } catch {
        return {
          content: [
            {
              type: 'text',
              text:
                `Unknown timezone "${tz}". ` +
                'Use a valid IANA name like "America/New_York" or "Europe/London".',
            },
          ],
          isError: true,
        };
      }
    },
  );

  // ── create_note ─────────────────────────────────────────────────────────────
  mcp.tool(
    'create_note',
    'Saves a short note for the current user. Returns the note ID needed to delete it later.',
    {
      title: z.string().min(1).max(200).describe('Short note title'),
      content: z.string().min(1).max(4000).describe('Note body'),
    },
    ({ title, content }) => {
      const id = crypto.randomUUID();
      getUserNotes(userId).set(id, { title, content, createdAt: new Date().toISOString() });
      return {
        content: [
          {
            type: 'text',
            text: `Note saved.\nID:    ${id}\nTitle: ${title}\nUser:  ${userId}`,
          },
        ],
      };
    },
  );

  // ── list_notes ──────────────────────────────────────────────────────────────
  mcp.tool(
    'list_notes',
    'Lists all notes saved by the current user.',
    {},
    () => {
      const notes = getUserNotes(userId);
      if (notes.size === 0) {
        return {
          content: [{ type: 'text', text: `No notes found for user "${userId}".` }],
        };
      }
      const lines = [...notes.entries()].map(
        ([id, n]) =>
          `• ${n.title}\n  ID:      ${id}\n  Created: ${n.createdAt}\n  Content: ${n.content}`,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Notes for "${userId}" (${notes.size} total):\n\n${lines.join('\n\n')}`,
          },
        ],
      };
    },
  );

  // ── delete_note ─────────────────────────────────────────────────────────────
  mcp.tool(
    'delete_note',
    'Permanently deletes a note by its ID.',
    { id: z.string().uuid().describe('Note ID returned by create_note') },
    ({ id }) => {
      const notes = getUserNotes(userId);
      if (!notes.has(id)) {
        return {
          content: [{ type: 'text', text: `Note "${id}" not found for user "${userId}".` }],
          isError: true,
        };
      }
      const { title } = notes.get(id)!;
      notes.delete(id);
      return { content: [{ type: 'text', text: `Deleted note "${title}" (${id}).` }] };
    },
  );

  // ── echo ─────────────────────────────────────────────────────────────────────
  mcp.tool(
    'echo',
    'Echoes a message back with server metadata. Use to verify the MCP connection is working.',
    { message: z.string().describe('Any text to echo back') },
    ({ message }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              echo: message,
              userId,
              server: 'centrai-demo@0.1.0',
              timestamp: new Date().toISOString(),
              noteCount: getUserNotes(userId).size,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  return mcp;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

/**
 * MCP endpoint — one stateless transport per request.
 * `sessionIdGenerator: undefined` tells the SDK not to generate/track session IDs,
 * which keeps the server simple and stateless at the transport layer.
 * Per-user note state is maintained separately in `notesByUser`.
 */
app.all('/mcp', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(401).json({
      error: 'Unauthorized',
      hint: 'Set Authorization: Bearer <DEMO_TOKEN>, or unset DEMO_TOKEN to disable auth.',
    });
    return;
  }

  const userId = (req.headers['x-user-id'] as string) || 'anonymous';
  const mcp = createServer(userId);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    // Close quietly — transport errors on disconnect are expected in stateless mode.
    await mcp.close().catch(() => undefined);
  }
});

app.get('/health', (_req, res) => {
  const userCount = notesByUser.size;
  const noteCount = [...notesByUser.values()].reduce((n, m) => n + m.size, 0);
  res.json({ status: 'ok', server: 'centrai-demo', version: '0.1.0', userCount, noteCount });
});

app.listen(PORT, () => {
  const authStatus = process.env.DEMO_TOKEN ? 'enabled (DEMO_TOKEN set)' : 'disabled';
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  CentrAI Demo MCP Server                                ║
╚══════════════════════════════════════════════════════════╝
  Port   : ${PORT}
  MCP    : http://localhost:${PORT}/mcp
  Health : http://localhost:${PORT}/health
  Auth   : ${authStatus}

  Add to .centrai/.mcp.json to connect from CentrAI-Chat:
  (see examples/demo-mcp-server/README.md)
`);
});
