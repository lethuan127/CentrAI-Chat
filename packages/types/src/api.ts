import { z } from 'zod';
import type { Role } from './models';

// ─── Auth DTOs ──────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required').max(100),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

// ─── Response Envelope ──────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error: null;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

// ─── Chat DTOs ───────────────────────────────────────────────

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1, 'Message cannot be empty').max(100_000),
  agentId: z.string().uuid().optional(),
  modelId: z.string().optional(),
  /** When `modelId` is a short id (e.g. `gpt-4o`), backend key: `openai`, `anthropic`, … */
  modelProvider: z.string().max(64).optional(),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;

// ─── Conversation DTOs ───────────────────────────────────────

export const createConversationSchema = z.object({
  agentId: z.string().uuid().optional(),
  modelId: z.string().optional(),
  modelProvider: z.string().max(64).optional(),
  title: z.string().max(200).optional(),
});

export type CreateConversationDto = z.infer<typeof createConversationSchema>;

export const conversationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  agentId: z.string().uuid().optional(),
  modelId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  archived: z.coerce.boolean().optional().default(false),
});

export type ConversationQueryDto = z.infer<typeof conversationQuerySchema>;

export const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export type UpdateConversationDto = z.infer<typeof updateConversationSchema>;

export const exportConversationSchema = z.object({
  format: z.enum(['json', 'md']).default('json'),
});

export type ExportConversationDto = z.infer<typeof exportConversationSchema>;

export const messageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(500),
  before: z.string().datetime().optional(),
});

export type MessageQueryDto = z.infer<typeof messageQuerySchema>;

export const updateActiveLeafSchema = z.object({
  messageId: z.string().uuid(),
});

export type UpdateActiveLeafDto = z.infer<typeof updateActiveLeafSchema>;

export const editUserMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(100_000),
});

export type EditUserMessageDto = z.infer<typeof editUserMessageSchema>;

// ─── Agent Tool Catalog ──────────────────────────────────────

/**
 * UI-safe description of a built-in agent toolkit.
 * Returned by `GET /agents/tools` so the frontend can render the tool picker.
 */
export interface ToolkitInfo {
  /** Stable registry key stored in `Agent.tools[].name`. */
  name: string;
  /** Human-readable label for the UI tool picker. */
  displayName: string;
  /** One-sentence description shown in the UI. */
  description: string;
  /** UI grouping category (e.g. `"Web"`, `"Productivity"`). */
  category: string;
  /**
   * Environment variable names the toolkit requires to function.
   * The UI can use this to show a config warning when vars are absent.
   */
  requiredEnvVars?: string[];
}


export const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  role: z.string().min(1, 'Role is required').max(10_000),
  instructions: z.string().min(1, 'Instructions are required').max(50_000),
  expectedOutput: z.string().max(10_000).optional(),
  modelId: z.string().optional(),
  modelProvider: z.string().optional(),
  modelTemperature: z.number().min(0).max(2).default(0.7),
  modelMaxTokens: z.number().int().positive().optional(),
  addSessionStateToContext: z.boolean().default(false),
  maxTurnsMessageHistory: z.number().int().positive().optional(),
  enableSessionSummaries: z.boolean().default(false),
  tools: z.array(z.record(z.unknown())).default([]),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

export type CreateAgentDto = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  role: z.string().min(1).max(10_000).optional(),
  instructions: z.string().min(1).max(50_000).optional(),
  expectedOutput: z.string().max(10_000).optional().nullable(),
  modelId: z.string().optional().nullable(),
  modelProvider: z.string().optional().nullable(),
  modelTemperature: z.number().min(0).max(2).optional(),
  modelMaxTokens: z.number().int().positive().optional().nullable(),
  addSessionStateToContext: z.boolean().optional(),
  maxTurnsMessageHistory: z.number().int().positive().optional().nullable(),
  enableSessionSummaries: z.boolean().optional(),
  tools: z.array(z.record(z.unknown())).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  changelog: z.string().max(500).optional(),
});

export type UpdateAgentDto = z.infer<typeof updateAgentSchema>;

export const agentQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  tags: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['name', 'createdAt', 'updatedAt', 'version']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type AgentQueryDto = z.infer<typeof agentQuerySchema>;

// ─── Admin: User Management DTOs ─────────────────────────────

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['ADMIN', 'DEVELOPER', 'USER']).optional(),
  isActive: z.coerce.boolean().optional(),
  sort: z.enum(['name', 'email', 'role', 'createdAt', 'lastLoginAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type AdminUserQueryDto = z.infer<typeof adminUserQuerySchema>;

export const adminUpdateUserSchema = z.object({
  role: z.enum(['ADMIN', 'DEVELOPER', 'USER']).optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
});

export type AdminUpdateUserDto = z.infer<typeof adminUpdateUserSchema>;

// ─── Admin: Analytics DTOs ───────────────────────────────────

export const analyticsRangeSchema = z.object({
  range: z.enum(['1d', '7d', '30d', '90d']).default('7d'),
});

export type AnalyticsRangeDto = z.infer<typeof analyticsRangeSchema>;

export interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  todayConversations: number;
  todayMessages: number;
  todayTokens: number;
  totalAgents: number;
  publishedAgents: number;
  /** Number of LLM backends that have API credentials set in the API process environment. */
  configuredLlmBackends: number;
}

export interface UsageTrendPoint {
  date: string;
  conversations: number;
  messages: number;
  tokens: number;
}

// ─── Admin: Audit Log DTOs ──────────────────────────────────

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type AuditLogQueryDto = z.infer<typeof auditLogQuerySchema>;

// ─── Admin: System Settings DTOs ────────────────────────────

export const updateSystemSettingsSchema = z.object({
  defaultModel: z.string().optional(),
  defaultProvider: z.string().optional(),
  registrationEnabled: z.boolean().optional(),
  maxConversationsPerUser: z.number().int().positive().optional(),
  maxMessagesPerConversation: z.number().int().positive().optional(),
  rateLimitPerMinute: z.number().int().positive().optional(),
  maintenanceMode: z.boolean().optional(),
});

export type UpdateSystemSettingsDto = z.infer<typeof updateSystemSettingsSchema>;

export interface SystemSettings {
  defaultModel: string;
  defaultProvider: string;
  registrationEnabled: boolean;
  maxConversationsPerUser: number;
  maxMessagesPerConversation: number;
  rateLimitPerMinute: number;
  maintenanceMode: boolean;
}

// ─── Admin: LLM backend health (env credentials + connectivity) ─────────────────

export interface LlmBackendHealth {
  backendKey: string;
  displayName: string;
  isConfigured: boolean;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latencyMs: number | null;
  lastChecked: string | null;
  catalogModels: number;
  errorMessage?: string;
}

/** Models available for chat when the corresponding env credentials are set on the API. */
export interface EnabledLlmModelGroup {
  backendKey: string;
  backendName: string;
  backendType: string;
  models: Array<{
    id: string;
    name: string;
    contextWindow: number | null;
    capabilities: Record<string, boolean>;
  }>;
}

// ─── Auth Responses ─────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    role: Role;
  };
  tokens: TokenPair;
}
