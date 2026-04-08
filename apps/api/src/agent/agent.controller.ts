import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import {
  createAgentSchema,
  updateAgentSchema,
  agentQuerySchema,
} from '@centrai/types';
import type { CreateAgentDto, UpdateAgentDto, AgentQueryDto } from '@centrai/types';
import { AgentService } from './agent.service';
import { Roles, CurrentUser } from '../common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Audit } from '../admin/audit.interceptor';
import { Role } from '../generated/prisma/enums.js';
import {
  CreateAgentBody,
  UpdateAgentBody,
  AgentModel,
  PublishedAgentModel,
  AgentVersionModel,
} from '../common/swagger/schemas';
import { apiEnvelopeSchema } from '../common/swagger/zod-to-openapi';

interface JwtUser {
  id: string;
  email: string;
  role: string;
  workspaceId: string;
}

@ApiTags('Agents')
@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  // ─── Admin/Developer CRUD ──────────────────────────────────

  @Post()
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @Audit({ action: 'agent.create', resourceType: 'agent' })
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new agent (admin/developer)' })
  @ApiBody({ schema: CreateAgentBody, description: 'Agent definition' })
  @ApiResponse({ status: 201, description: 'Agent created', schema: apiEnvelopeSchema(AgentModel) })
  async create(
    @Body(new ZodValidationPipe(createAgentSchema)) dto: CreateAgentDto,
    @CurrentUser() user: JwtUser,
  ) {
    const agent = await this.agentService.create(dto, user.id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Get()
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List all agents with filters (admin/developer)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name/description' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], description: 'Filter by status' })
  @ApiQuery({ name: 'tags', required: false, type: String, description: 'Comma-separated tag filter' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'sort', required: false, enum: ['name', 'createdAt', 'updatedAt', 'version'], description: 'Sort field' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponse({
    status: 200,
    description: 'Paginated agent list',
    schema: apiEnvelopeSchema({ type: 'array', items: AgentModel }),
  })
  async findAll(
    @Query(new ZodValidationPipe(agentQuerySchema)) query: AgentQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.agentService.findAll(query, user.workspaceId);
    return { data: result.items, error: null, meta: result.meta };
  }

  @Get('published')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List published agents for chat picker (all authenticated users)' })
  @ApiResponse({
    status: 200,
    description: 'Published agents',
    schema: apiEnvelopeSchema({ type: 'array', items: PublishedAgentModel }),
  })
  async findPublished(@CurrentUser() user: JwtUser) {
    const agents = await this.agentService.findPublished(user.workspaceId);
    return { data: agents, error: null };
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get agent details (admin/developer)' })
  @ApiParam({ name: 'id', description: 'Agent UUID', format: 'uuid' })
  @ApiQuery({ name: 'version', required: false, type: Number, description: 'Specific version number' })
  @ApiResponse({ status: 200, description: 'Agent details', schema: apiEnvelopeSchema(AgentModel) })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('version') version: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    const versionNum = version ? parseInt(version, 10) : undefined;
    const agent = await this.agentService.findOne(id, user.workspaceId, versionNum);
    return { data: agent, error: null };
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @Audit({ action: 'agent.update', resourceType: 'agent' })
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update an agent (creates new version)' })
  @ApiParam({ name: 'id', description: 'Agent UUID', format: 'uuid' })
  @ApiBody({ schema: UpdateAgentBody, description: 'Fields to update' })
  @ApiResponse({ status: 200, description: 'Agent updated', schema: apiEnvelopeSchema(AgentModel) })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAgentSchema)) dto: UpdateAgentDto,
    @CurrentUser() user: JwtUser,
  ) {
    const agent = await this.agentService.update(id, dto, user.id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Post(':id/publish')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @Audit({ action: 'agent.publish', resourceType: 'agent' })
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish an agent (draft → published)' })
  @ApiParam({ name: 'id', description: 'Agent UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent published', schema: apiEnvelopeSchema(AgentModel) })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const agent = await this.agentService.publish(id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Post(':id/archive')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive an agent' })
  @ApiParam({ name: 'id', description: 'Agent UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent archived', schema: apiEnvelopeSchema(AgentModel) })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const agent = await this.agentService.archive(id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Post(':id/unpublish')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish an agent (published → draft)' })
  @ApiParam({ name: 'id', description: 'Agent UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent unpublished', schema: apiEnvelopeSchema(AgentModel) })
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const agent = await this.agentService.unpublish(id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @Audit({ action: 'agent.delete', resourceType: 'agent' })
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete an agent' })
  @ApiParam({ name: 'id', description: 'Agent UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.agentService.remove(id, user.workspaceId);
    return { data: { message: 'Agent deleted' }, error: null };
  }

  @Get(':id/versions')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get version history for an agent' })
  @ApiParam({ name: 'id', description: 'Agent UUID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Version list',
    schema: apiEnvelopeSchema({ type: 'array', items: AgentVersionModel }),
  })
  async getVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const versions = await this.agentService.getVersions(id, user.workspaceId);
    return { data: versions, error: null };
  }
}
