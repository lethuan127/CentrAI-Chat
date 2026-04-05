import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import {
  createAgentSchema,
  updateAgentSchema,
  agentQuerySchema,
} from '@centrai/types';
import type { CreateAgentDto, UpdateAgentDto, AgentQueryDto } from '@centrai/types';
import { AgentService } from './agent.service';
import { Roles, CurrentUser } from '../common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Role } from '../generated/prisma/enums.js';

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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new agent (admin/developer)' })
  @ApiResponse({ status: 201, description: 'Agent created' })
  @UsePipes(new ZodValidationPipe(createAgentSchema))
  async create(@Body() dto: CreateAgentDto, @CurrentUser() user: JwtUser) {
    const agent = await this.agentService.create(dto, user.id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Get()
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all agents with filters (admin/developer)' })
  @ApiResponse({ status: 200, description: 'Agent list' })
  async findAll(
    @Query(new ZodValidationPipe(agentQuerySchema)) query: AgentQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.agentService.findAll(query, user.workspaceId);
    return { data: result.items, error: null, meta: result.meta };
  }

  @Get('published')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List published agents for chat picker (all authenticated users)' })
  @ApiResponse({ status: 200, description: 'Published agents' })
  async findPublished(@CurrentUser() user: JwtUser) {
    const agents = await this.agentService.findPublished(user.workspaceId);
    return { data: agents, error: null };
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get agent details (admin/developer)' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiQuery({ name: 'version', required: false, description: 'Specific version number' })
  @ApiResponse({ status: 200, description: 'Agent details' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an agent (creates new version)' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Agent updated' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  @UsePipes(new ZodValidationPipe(updateAgentSchema))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() user: JwtUser,
  ) {
    const agent = await this.agentService.update(id, dto, user.id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Post(':id/publish')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish an agent (draft → published)' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Agent published' })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const agent = await this.agentService.publish(id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Post(':id/archive')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive an agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Agent archived' })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const agent = await this.agentService.archive(id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Post(':id/unpublish')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish an agent (published → draft)' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Agent unpublished' })
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const agent = await this.agentService.unpublish(id, user.workspaceId);
    return { data: agent, error: null };
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete an agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get version history for an agent' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Version list' })
  async getVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const versions = await this.agentService.getVersions(id, user.workspaceId);
    return { data: versions, error: null };
  }
}
