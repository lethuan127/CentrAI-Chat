import type { ProviderTypeKey } from './provider-type';

/** Curated models for admin UI and enabled-model lists (credentials still come from env on the API). */
export interface LlmCatalogModel {
  id: string;
  name: string;
  contextWindow: number | null;
  capabilities: Record<string, boolean>;
}

export const LLM_MODEL_CATALOG: Record<ProviderTypeKey, LlmCatalogModel[]> = {
  openai: [
    { id: 'gpt-5.4', name: 'GPT-5.4', contextWindow: 1050000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', contextWindow: 400000, capabilities: { vision: true, function_calling: true } },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', contextWindow: 400000, capabilities: { vision: true, function_calling: true } },
    { id: 'gpt-5', name: 'GPT-5', contextWindow: 400000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', contextWindow: 400000, capabilities: { vision: true, function_calling: true } },
    { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1047576, capabilities: { vision: true, function_calling: true } },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', contextWindow: 1047576, capabilities: { vision: true, function_calling: true } },
    { id: 'o3', name: 'o3', contextWindow: 200000, capabilities: { reasoning: true, vision: true, function_calling: true } },
    { id: 'o4-mini', name: 'o4-mini', contextWindow: 200000, capabilities: { reasoning: true, function_calling: true } },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextWindow: 1000000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 1000000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', contextWindow: 200000, capabilities: { vision: true, function_calling: true } },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextWindow: 200000, capabilities: { vision: true, function_calling: true, reasoning: true } },
  ],
  google: [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', contextWindow: 1000000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', contextWindow: 1000000, capabilities: { vision: true, function_calling: true } },
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash-Lite', contextWindow: 1000000, capabilities: { vision: true, function_calling: true } },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1048576, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576, capabilities: { vision: true, function_calling: true } },
  ],
  ollama: [],
  custom: [],
};

export const LLM_BACKEND_LABELS: Record<ProviderTypeKey, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  ollama: 'Ollama',
  custom: 'Custom (OpenAI-compatible)',
};
