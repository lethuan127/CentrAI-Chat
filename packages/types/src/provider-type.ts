import { z } from 'zod';

/** LLM backend discriminator (e.g. agent `modelProvider` and API hints). */
export const providerTypeKeySchema = z.enum(['openai', 'anthropic', 'google', 'ollama', 'custom']);

export type ProviderTypeKey = z.infer<typeof providerTypeKeySchema>;

const LEGACY_UPPERCASE: Record<string, ProviderTypeKey> = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  OLLAMA: 'ollama',
  CUSTOM: 'custom',
};

const LOWER_KEYS = ['openai', 'anthropic', 'google', 'ollama', 'custom'] as const;

/** Normalize request/query input: accepts lowercase or legacy uppercase (e.g. OPENAI). */
export function normalizeProviderTypeInput(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const s = raw.trim();
  const lower = s.toLowerCase();
  if ((LOWER_KEYS as readonly string[]).includes(lower)) return lower;
  const mapped = LEGACY_UPPERCASE[s.toUpperCase()];
  if (mapped) return mapped;
  return raw;
}
