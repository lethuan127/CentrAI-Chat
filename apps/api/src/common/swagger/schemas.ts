import { type SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  createConversationSchema,
  conversationQuerySchema,
  messageQuerySchema,
  exportConversationSchema,
  sendMessageSchema,
  createAgentSchema,
  updateAgentSchema,
  agentQuerySchema,
  createProviderSchema,
  updateProviderSchema,
  providerQuerySchema,
  updateProviderModelSchema,
  adminUserQuerySchema,
  adminUpdateUserSchema,
  analyticsRangeSchema,
  auditLogQuerySchema,
  updateSystemSettingsSchema,
} from '@centrai/types';
import {
  userSchema,
  agentSchema,
  publishedAgentSchema,
  agentVersionSchema,
  providerSchema,
  providerModelSchema,
  conversationSchema,
  messageSchema,
  auditLogSchema,
} from '@centrai/types';
import { zodToOpenApi } from './zod-to-openapi';

// ─── Request Schemas ─────────────────────────────────────────

export const RegisterBody = zodToOpenApi(registerSchema);
export const LoginBody = zodToOpenApi(loginSchema);
export const RefreshTokenBody = zodToOpenApi(refreshTokenSchema);

export const CreateConversationBody = zodToOpenApi(createConversationSchema);
export const ConversationQuery = zodToOpenApi(conversationQuerySchema);
export const MessageQuery = zodToOpenApi(messageQuerySchema);
export const ExportConversationQuery = zodToOpenApi(exportConversationSchema);
export const SendMessageBody = zodToOpenApi(sendMessageSchema);

export const CreateAgentBody = zodToOpenApi(createAgentSchema);
export const UpdateAgentBody = zodToOpenApi(updateAgentSchema);
export const AgentQuery = zodToOpenApi(agentQuerySchema);

export const CreateProviderBody = zodToOpenApi(createProviderSchema);
export const UpdateProviderBody = zodToOpenApi(updateProviderSchema);
export const ProviderQuery = zodToOpenApi(providerQuerySchema);
export const UpdateProviderModelBody = zodToOpenApi(updateProviderModelSchema);

export const AdminUserQuery = zodToOpenApi(adminUserQuerySchema);
export const AdminUpdateUserBody = zodToOpenApi(adminUpdateUserSchema);
export const AnalyticsRangeQuery = zodToOpenApi(analyticsRangeSchema);
export const AuditLogQuery = zodToOpenApi(auditLogQuerySchema);
export const UpdateSystemSettingsBody = zodToOpenApi(updateSystemSettingsSchema);

// ─── Model Schemas ───────────────────────────────────────────

export const UserModel = zodToOpenApi(userSchema);
export const AgentModel = zodToOpenApi(agentSchema);
export const PublishedAgentModel = zodToOpenApi(publishedAgentSchema);
export const AgentVersionModel = zodToOpenApi(agentVersionSchema);
export const ProviderModelSchema = zodToOpenApi(providerSchema);
export const ProviderModelModelSchema = zodToOpenApi(providerModelSchema);
export const ConversationModel = zodToOpenApi(conversationSchema);
export const MessageModel = zodToOpenApi(messageSchema);
export const AuditLogModel = zodToOpenApi(auditLogSchema);

// ─── Composed Response Schemas ───────────────────────────────

export const TokenPairSchema: SchemaObject = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
  },
  required: ['accessToken', 'refreshToken'],
};

export const AuthResponseSchema: SchemaObject = {
  type: 'object',
  properties: {
    user: UserModel,
    tokens: TokenPairSchema,
  },
  required: ['user', 'tokens'],
};

export const PaginationMeta: SchemaObject = {
  type: 'object',
  properties: {
    total: { type: 'number', example: 42 },
    page: { type: 'number', example: 1 },
    limit: { type: 'number', example: 20 },
    totalPages: { type: 'number', example: 3 },
  },
};

export const AnalyticsOverviewSchema: SchemaObject = {
  type: 'object',
  properties: {
    totalUsers: { type: 'number' },
    activeUsers: { type: 'number' },
    totalConversations: { type: 'number' },
    totalMessages: { type: 'number' },
    totalTokens: { type: 'number' },
    todayConversations: { type: 'number' },
    todayMessages: { type: 'number' },
    todayTokens: { type: 'number' },
    totalAgents: { type: 'number' },
    publishedAgents: { type: 'number' },
    totalProviders: { type: 'number' },
    enabledProviders: { type: 'number' },
  },
};

export const UsageTrendPointSchema: SchemaObject = {
  type: 'object',
  properties: {
    date: { type: 'string', format: 'date' },
    conversations: { type: 'number' },
    messages: { type: 'number' },
    tokens: { type: 'number' },
  },
};

export const SystemSettingsSchema: SchemaObject = {
  type: 'object',
  properties: {
    defaultModel: { type: 'string' },
    defaultProvider: { type: 'string' },
    registrationEnabled: { type: 'boolean' },
    maxConversationsPerUser: { type: 'number' },
    maxMessagesPerConversation: { type: 'number' },
    rateLimitPerMinute: { type: 'number' },
    maintenanceMode: { type: 'boolean' },
  },
};

export const ProviderHealthSchema: SchemaObject = {
  type: 'object',
  properties: {
    providerId: { type: 'string', format: 'uuid' },
    providerName: { type: 'string' },
    providerType: { type: 'string' },
    isEnabled: { type: 'boolean' },
    status: { type: 'string', enum: ['healthy', 'degraded', 'down', 'unknown'] },
    latencyMs: { type: 'number', nullable: true },
    lastChecked: { type: 'string', nullable: true },
    enabledModels: { type: 'number' },
    totalModels: { type: 'number' },
    errorMessage: { type: 'string' },
  },
};

/**
 * All named schemas to register in the OpenAPI document's components.schemas.
 */
export const componentSchemas: Record<string, SchemaObject> = {
  RegisterRequest: RegisterBody,
  LoginRequest: LoginBody,
  RefreshTokenRequest: RefreshTokenBody,
  TokenPair: TokenPairSchema,
  AuthResponse: AuthResponseSchema,
  User: UserModel,
  CreateConversationRequest: CreateConversationBody,
  Conversation: ConversationModel,
  Message: MessageModel,
  SendMessageRequest: SendMessageBody,
  CreateAgentRequest: CreateAgentBody,
  UpdateAgentRequest: UpdateAgentBody,
  Agent: AgentModel,
  PublishedAgent: PublishedAgentModel,
  AgentVersion: AgentVersionModel,
  CreateProviderRequest: CreateProviderBody,
  UpdateProviderRequest: UpdateProviderBody,
  UpdateProviderModelRequest: UpdateProviderModelBody,
  Provider: ProviderModelSchema,
  ProviderModel: ProviderModelModelSchema,
  AdminUpdateUserRequest: AdminUpdateUserBody,
  UpdateSystemSettingsRequest: UpdateSystemSettingsBody,
  AnalyticsOverview: AnalyticsOverviewSchema,
  UsageTrendPoint: UsageTrendPointSchema,
  SystemSettings: SystemSettingsSchema,
  ProviderHealth: ProviderHealthSchema,
  AuditLog: AuditLogModel,
  PaginationMeta: PaginationMeta,
};
