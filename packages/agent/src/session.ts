export type SessionState = Record<string, unknown>;

export function formatSessionStateBlock(state: SessionState | null | undefined): string {
  if (state == null || Object.keys(state).length === 0) {
    return '';
  }
  try {
    return JSON.stringify(state, null, 2);
  } catch {
    return String(state);
  }
}
