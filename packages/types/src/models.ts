import { z } from 'zod';

// ─── User ────────────────────────────────────────────────────

export const Role = {
  ADMIN: 'ADMIN',
  DEVELOPER: 'DEVELOPER',
  USER: 'USER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const AuthProvider = {
  LOCAL: 'LOCAL',
  GOOGLE: 'GOOGLE',
  GITHUB: 'GITHUB',
} as const;

export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatar: z.string().url().nullable(),
  role: z.enum(['ADMIN', 'DEVELOPER', 'USER']),
  authProvider: z.enum(['LOCAL', 'GOOGLE', 'GITHUB']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;

// ─── Agent ───────────────────────────────────────────────────

export const AgentStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const agentSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  role: z.string(),
  instructions: z.string(),
  expectedOutput: z.string().nullable(),
  modelId: z.string().nullable(),
  modelProvider: z.string().nullable(),
  modelTemperature: z.number(),
  modelMaxTokens: z.number().int().nullable(),
  addSessionStateToContext: z.boolean(),
  maxTurnsMessageHistory: z.number().int().nullable(),
  enableSessionSummaries: z.boolean(),
  tools: z.unknown(),
  tags: z.array(z.string()),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  version: z.number().int(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Agent = z.infer<typeof agentSchema>;

export const agentVersionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  version: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  role: z.string(),
  instructions: z.string(),
  expectedOutput: z.string().nullable(),
  modelId: z.string().nullable(),
  modelProvider: z.string().nullable(),
  modelTemperature: z.number(),
  modelMaxTokens: z.number().int().nullable(),
  addSessionStateToContext: z.boolean(),
  maxTurnsMessageHistory: z.number().int().nullable(),
  enableSessionSummaries: z.boolean(),
  tools: z.unknown(),
  tags: z.array(z.string()),
  changelog: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
});

export type AgentVersion = z.infer<typeof agentVersionSchema>;

export const publishedAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  modelId: z.string().nullable(),
  modelProvider: z.string().nullable(),
});

export type PublishedAgent = z.infer<typeof publishedAgentSchema>;

// ─── Provider ────────────────────────────────────────────────

export const ProviderType = {
  OPENAI: 'OPENAI',
  ANTHROPIC: 'ANTHROPIC',
  GOOGLE: 'GOOGLE',
  OLLAMA: 'OLLAMA',
  CUSTOM: 'CUSTOM',
} as const;

export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

export const providerSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  type: z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE', 'OLLAMA', 'CUSTOM']),
  baseUrl: z.string().nullable(),
  isEnabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Provider = z.infer<typeof providerSchema>;

export const providerModelSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string().uuid(),
  modelId: z.string(),
  name: z.string(),
  contextWindow: z.number().int().nullable(),
  isEnabled: z.boolean(),
  capabilities: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ProviderModel = z.infer<typeof providerModelSchema>;

// ─── Message Role ────────────────────────────────────────────

export const MessageRole = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
  SYSTEM: 'SYSTEM',
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

// ─── Conversation ────────────────────────────────────────────

export const conversationSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  modelId: z.string().nullable(),
  providerId: z.string().nullable(),
  title: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  archivedAt: z.coerce.date().nullable().optional(),
  activeLeafMessageId: z.string().uuid().nullable().optional(),
  forkedFromConversationId: z.string().uuid().nullable().optional(),
  forkedFromMessageId: z.string().uuid().nullable().optional(),
});

export type Conversation = z.infer<typeof conversationSchema>;

// ─── Message ─────────────────────────────────────────────────

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  role: z.enum(['USER', 'ASSISTANT', 'SYSTEM']),
  content: z.string(),
  tokenCount: z.number().int().nullable(),
  createdAt: z.coerce.date(),
  parentId: z.string().uuid().nullable().optional(),
});

export type Message = z.infer<typeof messageSchema>;

// ─── Audit Log ──────────────────────────────────────────────

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  actorId: z.string().nullable(),
  actorEmail: z.string().nullable(),
  actorIp: z.string().nullable(),
  action: z.string(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
  status: z.string(),
  createdAt: z.coerce.date(),
});

export type AuditLog = z.infer<typeof auditLogSchema>;

// ─── System Setting ─────────────────────────────────────────

export const systemSettingSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export type SystemSetting = z.infer<typeof systemSettingSchema>;
