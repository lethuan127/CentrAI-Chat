/**
 * Predefined RequestContext variable names available in Handlebars templates.
 *
 * These keys are populated by the API layer before each `agent.stream()` call
 * (via `createCentrAiChatStream({ requestContext })`). They can be referenced
 * as `{{USER_NAME}}`, `{{CONVERSATION_ID}}`, etc. in:
 *
 * - **Agent instructions** — admin writes instructions as a Handlebars template;
 *   CentrAI renders them at stream time with the request context data.
 * - **MCP server headers** — e.g. `Authorization: Bearer {{USER_ACCESS_TOKEN}}`
 *   is resolved per-request without reconnecting the MCP client.
 *
 * @example Agent instruction template
 * ```
 * You are helping {{USER_NAME}} ({{USER_EMAIL}}).
 * Current conversation: {{CONVERSATION_ID}}.
 * ```
 *
 * @example MCP header config (.centrai/mcp.json)
 * ```json
 * { "headers": { "Authorization": "Bearer {{USER_ACCESS_TOKEN}}" } }
 * ```
 */
export const CENTRAI_CONTEXT_VAR = {
  /** JWT / session token for the authenticated end-user. */
  USER_ACCESS_TOKEN: 'USER_ACCESS_TOKEN',
  /** Unique identifier of the authenticated end-user (UUID). */
  USER_ID: 'USER_ID',
  /** Display name of the authenticated end-user. */
  USER_NAME: 'USER_NAME',
  /** Email address of the authenticated end-user. */
  USER_EMAIL: 'USER_EMAIL',
  /** Unique identifier of the active conversation (UUID). */
  CONVERSATION_ID: 'CONVERSATION_ID',
  /** Unique identifier of the current message being processed (UUID). */
  MESSAGE_ID: 'MESSAGE_ID',
  /** Identifier of the parent message in a branched conversation, if any. */
  PARENT_MESSAGE_ID: 'PARENT_MESSAGE_ID',
} as const;

export type CentrAIContextVar = (typeof CENTRAI_CONTEXT_VAR)[keyof typeof CENTRAI_CONTEXT_VAR];

/** Partial record of well-known context variable values (all strings). */
export type CentrAIContextData = Partial<Record<CentrAIContextVar, string>>;

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------

/**
 * Duck-typed interface compatible with Mastra `RequestContext` (a Map subclass).
 * Avoids importing `@mastra/core` so domain files stay dep-light.
 */
export interface RequestContextLike {
  get(key: string): unknown;
  entries(): IterableIterator<[string, unknown]>;
}

/**
 * Converts a Mastra `RequestContext` into a plain `Record<string, string>`
 * suitable for passing to a compiled Handlebars template.
 *
 * Resolution order (highest priority wins):
 * 1. Values from `requestContext` (per-request, set by the API layer).
 * 2. `process.env` values for {@link CENTRAI_CONTEXT_VAR} keys (server-wide
 *    fallback, useful for shared service tokens).
 * 3. Handlebars default — missing keys render as empty string `""`.
 *
 * @param ctx - Mastra `RequestContext` or any Map-like object; `null`/`undefined` is safe.
 */
export function buildTemplateData(
  ctx: RequestContextLike | null | undefined,
): Record<string, string> {
  const data: Record<string, string> = {};

  // Populate well-known vars from process.env as low-priority fallback.
  for (const varName of Object.values(CENTRAI_CONTEXT_VAR)) {
    const envVal = process.env[varName];
    if (envVal != null) data[varName] = envVal;
  }

  // Per-request context overrides env values.
  if (ctx) {
    for (const [key, value] of ctx.entries()) {
      if (value != null) data[key] = String(value);
    }
  }

  return data;
}
