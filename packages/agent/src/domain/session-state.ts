/**
 * Optional session snapshot merged into prompts when `addSessionStateToContext` is enabled.
 */
export type SessionState = Record<string, unknown>;

export function formatSessionStateBlock(state: SessionState | null | undefined): string {
  if (state == null || Object.keys(state).length === 0) return '';
  return JSON.stringify(state, null, 2);
}
