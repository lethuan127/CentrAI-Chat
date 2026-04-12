import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import {
  adminUserQuerySchema,
  adminUpdateUserSchema,
  analyticsRangeSchema,
  auditLogQuerySchema,
  updateSystemSettingsSchema,
} from '@centrai/types';
import {
  AdminUserQueryDto,
  AdminUpdateUserDto,
  AnalyticsRangeDto,
  AuditLogQueryDto,
  UpdateSystemSettingsDto,
} from '@centrai/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Audit } from './audit.interceptor';
import { AdminService } from './admin.service';
import {
  AdminUpdateUserBody,
  UpdateSystemSettingsBody,
  UserModel,
  AuditLogModel,
  AnalyticsOverviewSchema,
  UsageTrendPointSchema,
  SystemSettingsSchema,
  LlmBackendHealthSchema,
} from '../common/swagger/schemas';
import { apiEnvelopeSchema } from '../common/swagger/zod-to-openapi';

@ApiTags('Admin')
@ApiBearerAuth('bearer')
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── User Management ──────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or email' })
  @ApiQuery({ name: 'role', required: false, enum: ['ADMIN', 'DEVELOPER', 'USER'], description: 'Filter by role' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiQuery({ name: 'sort', required: false, enum: ['name', 'email', 'role', 'createdAt', 'lastLoginAt'], description: 'Sort field' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponse({
    status: 200,
    description: 'Paginated user list',
    schema: apiEnvelopeSchema({ type: 'array', items: UserModel }),
  })
  async listUsers(
    @Query(new ZodValidationPipe(adminUserQuerySchema)) query: AdminUserQueryDto,
    @CurrentUser() user: { workspaceId: string },
  ) {
    const result = await this.adminService.listUsers(user.workspaceId, query);
    return { data: result.items, error: null, meta: result.meta };
  }

  @Patch('users/:id')
  @Audit({ action: 'user.update', resourceType: 'user' })
  @ApiOperation({ summary: 'Update a user role or status (admin only)' })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiBody({ schema: AdminUpdateUserBody, description: 'Fields to update' })
  @ApiResponse({ status: 200, description: 'User updated', schema: apiEnvelopeSchema(UserModel) })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdateUserSchema)) dto: AdminUpdateUserDto,
  ) {
    const user = await this.adminService.updateUser(id, dto);
    return { data: user, error: null };
  }

  // ─── Analytics ─────────────────────────────────────────────

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Get analytics overview (admin only)' })
  @ApiResponse({ status: 200, description: 'Analytics overview data', schema: apiEnvelopeSchema(AnalyticsOverviewSchema) })
  async getAnalyticsOverview(
    @CurrentUser() user: { workspaceId: string },
  ) {
    const overview = await this.adminService.getAnalyticsOverview(user.workspaceId);
    return { data: overview, error: null };
  }

  @Get('analytics/usage')
  @ApiOperation({ summary: 'Get usage trend data (admin only)' })
  @ApiQuery({ name: 'range', required: false, enum: ['1d', '7d', '30d', '90d'], description: 'Time range (default: 7d)' })
  @ApiResponse({
    status: 200,
    description: 'Daily usage trend',
    schema: apiEnvelopeSchema({ type: 'array', items: UsageTrendPointSchema }),
  })
  async getUsageTrend(
    @Query(new ZodValidationPipe(analyticsRangeSchema)) query: AnalyticsRangeDto,
    @CurrentUser() user: { workspaceId: string },
  ) {
    const trend = await this.adminService.getUsageTrend(user.workspaceId, query.range);
    return { data: trend, error: null };
  }

  // ─── Audit Log ─────────────────────────────────────────────

  @Get('audit-log')
  @ApiOperation({ summary: 'Get audit log (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50, max: 100)' })
  @ApiQuery({ name: 'actorId', required: false, type: String, description: 'Filter by actor UUID' })
  @ApiQuery({ name: 'action', required: false, type: String, description: 'Filter by action (e.g. agent.create)' })
  @ApiQuery({ name: 'resourceType', required: false, type: String, description: 'Filter by resource type' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status (success/failure)' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated audit log',
    schema: apiEnvelopeSchema({ type: 'array', items: AuditLogModel }),
  })
  async getAuditLogs(
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQueryDto,
    @CurrentUser() user: { workspaceId: string },
  ) {
    const result = await this.adminService.getAuditLogs(user.workspaceId, query);
    return { data: result.items, error: null, meta: result.meta };
  }

  // ─── System Settings ──────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get system settings (admin only)' })
  @ApiResponse({ status: 200, description: 'Current system settings', schema: apiEnvelopeSchema(SystemSettingsSchema) })
  async getSettings(
    @CurrentUser() user: { workspaceId: string },
  ) {
    const settings = await this.adminService.getSystemSettings(user.workspaceId);
    return { data: settings, error: null };
  }

  @Patch('settings')
  @Audit({ action: 'settings.update', resourceType: 'settings' })
  @ApiOperation({ summary: 'Update system settings (admin only)' })
  @ApiBody({ schema: UpdateSystemSettingsBody, description: 'Settings to update' })
  @ApiResponse({ status: 200, description: 'Updated system settings', schema: apiEnvelopeSchema(SystemSettingsSchema) })
  async updateSettings(
    @Body(new ZodValidationPipe(updateSystemSettingsSchema)) dto: UpdateSystemSettingsDto,
    @CurrentUser() user: { workspaceId: string },
  ) {
    const settings = await this.adminService.updateSystemSettings(user.workspaceId, dto);
    return { data: settings, error: null };
  }

  // ─── LLM backend health (env credentials) ─────────────────

  @Get('llm/health')
  @ApiOperation({ summary: 'Check connectivity for LLM backends configured via environment (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Per-backend health from API environment variables',
    schema: apiEnvelopeSchema({ type: 'array', items: LlmBackendHealthSchema }),
  })
  async getLlmBackendHealth(
    @CurrentUser() user: { workspaceId: string },
  ) {
    const health = await this.adminService.getLlmBackendHealth(user.workspaceId);
    return { data: health, error: null };
  }
}
