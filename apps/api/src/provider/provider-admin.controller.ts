import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import {
  createProviderSchema,
  updateProviderSchema,
  providerQuerySchema,
  updateProviderModelSchema,
} from '@centrai/types';
import type {
  CreateProviderDto,
  UpdateProviderDto,
  ProviderQueryDto,
  UpdateProviderModelDto,
} from '@centrai/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Audit } from '../admin/audit.interceptor';
import { ProviderAdminService } from './provider-admin.service';
import {
  CreateProviderBody,
  UpdateProviderBody,
  UpdateProviderModelBody,
  ProviderModelSchema,
  ProviderModelModelSchema,
} from '../common/swagger/schemas';
import { apiEnvelopeSchema } from '../common/swagger/zod-to-openapi';

@ApiTags('Providers')
@ApiBearerAuth('bearer')
@Controller('providers')
export class ProviderAdminController {
  constructor(private readonly providerAdmin: ProviderAdminService) {}

  @Post()
  @Roles('ADMIN')
  @Audit({ action: 'provider.create', resourceType: 'provider' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new provider (admin only)' })
  @ApiBody({ schema: CreateProviderBody, description: 'Provider configuration' })
  @ApiResponse({ status: 201, description: 'Provider created with well-known models', schema: apiEnvelopeSchema(ProviderModelSchema) })
  async create(
    @Body(new ZodValidationPipe(createProviderSchema)) dto: CreateProviderDto,
    @CurrentUser() user: { workspaceId: string },
  ) {
    const provider = await this.providerAdmin.create(user.workspaceId, dto);
    return { data: provider, error: null };
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all configured providers (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'type', required: false, enum: ['openai', 'anthropic', 'google', 'ollama', 'custom'], description: 'Filter by provider type' })
  @ApiResponse({
    status: 200,
    description: 'Paginated provider list',
    schema: apiEnvelopeSchema({ type: 'array', items: ProviderModelSchema }),
  })
  async findAll(
    @Query(new ZodValidationPipe(providerQuerySchema)) query: ProviderQueryDto,
    @CurrentUser() user: { workspaceId: string },
  ) {
    const result = await this.providerAdmin.findAll(user.workspaceId, query);
    return { data: result.items, error: null, meta: result.meta };
  }

  @Get('enabled-models')
  @ApiOperation({ summary: 'List enabled models for end-user chat picker' })
  @ApiResponse({
    status: 200,
    description: 'Enabled models grouped by provider',
    schema: apiEnvelopeSchema({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          providerId: { type: 'string', format: 'uuid' },
          providerName: { type: 'string' },
          providerType: { type: 'string' },
          models: { type: 'array', items: ProviderModelModelSchema },
        },
      },
    }),
  })
  async getEnabledModels(@CurrentUser() user: { workspaceId: string }) {
    const models = await this.providerAdmin.getEnabledModels(user.workspaceId);
    return { data: models, error: null };
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get provider details (admin only)' })
  @ApiParam({ name: 'id', description: 'Provider UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Provider with models', schema: apiEnvelopeSchema(ProviderModelSchema) })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async findOne(@Param('id') id: string) {
    const provider = await this.providerAdmin.findById(id);
    return { data: provider, error: null };
  }

  @Patch(':id')
  @Roles('ADMIN')
  @Audit({ action: 'provider.update', resourceType: 'provider' })
  @ApiOperation({ summary: 'Update a provider (admin only)' })
  @ApiParam({ name: 'id', description: 'Provider UUID', format: 'uuid' })
  @ApiBody({ schema: UpdateProviderBody, description: 'Fields to update' })
  @ApiResponse({ status: 200, description: 'Provider updated', schema: apiEnvelopeSchema(ProviderModelSchema) })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProviderSchema)) dto: UpdateProviderDto,
  ) {
    const provider = await this.providerAdmin.update(id, dto);
    return { data: provider, error: null };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @Audit({ action: 'provider.delete', resourceType: 'provider' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a provider (admin only)' })
  @ApiParam({ name: 'id', description: 'Provider UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Provider deleted' })
  async remove(@Param('id') id: string) {
    await this.providerAdmin.remove(id);
    return { data: { deleted: true }, error: null };
  }

  @Post(':id/test')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Test provider connection (admin only)' })
  @ApiParam({ name: 'id', description: 'Provider UUID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Connection test result',
    schema: apiEnvelopeSchema({
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        latencyMs: { type: 'number' },
        modelsFound: { type: 'number' },
        error: { type: 'string', nullable: true },
      },
    }),
  })
  async testConnection(@Param('id') id: string) {
    const result = await this.providerAdmin.testConnection(id);
    return { data: result, error: null };
  }

  @Post(':id/sync')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Sync available models from provider (admin only)' })
  @ApiParam({ name: 'id', description: 'Provider UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Models synced', schema: apiEnvelopeSchema(ProviderModelSchema) })
  async syncModels(@Param('id') id: string) {
    const provider = await this.providerAdmin.syncModels(id);
    return { data: provider, error: null };
  }

  @Patch(':id/models/:modelId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Enable or disable a model (admin only)' })
  @ApiParam({ name: 'id', description: 'Provider UUID', format: 'uuid' })
  @ApiParam({ name: 'modelId', description: 'Model UUID', format: 'uuid' })
  @ApiBody({ schema: UpdateProviderModelBody, description: 'Enable/disable flag' })
  @ApiResponse({ status: 200, description: 'Model updated', schema: apiEnvelopeSchema(ProviderModelModelSchema) })
  async toggleModel(
    @Param('id') providerId: string,
    @Param('modelId') modelId: string,
    @Body(new ZodValidationPipe(updateProviderModelSchema)) dto: UpdateProviderModelDto,
  ) {
    const model = await this.providerAdmin.toggleModel(providerId, modelId, dto.isEnabled);
    return { data: model, error: null };
  }
}
