import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  Req,
  Res,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
  createConversationSchema,
  conversationQuerySchema,
  messageQuerySchema,
  exportConversationSchema,
} from '@centrai/types';
import type {
  CreateConversationDto,
  ConversationQueryDto,
  MessageQueryDto,
  ExportConversationDto,
} from '@centrai/types';
import {
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  streamText,
  convertToModelMessages,
} from 'ai';
import type { UIMessage } from 'ai';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ChatService } from './chat.service';
import { ProviderService } from '../provider';
import {
  CreateConversationBody,
  ConversationModel,
  MessageModel,
} from '../common/swagger/schemas';
import { apiEnvelopeSchema } from '../common/swagger/zod-to-openapi';

@ApiTags('Chat')
@ApiBearerAuth('bearer')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly providerService: ProviderService,
  ) {}

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createConversationSchema))
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiBody({ schema: CreateConversationBody, description: 'Conversation options (agent, model, title)' })
  @ApiResponse({ status: 201, description: 'Conversation created', schema: apiEnvelopeSchema(ConversationModel) })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: { id: string; workspaceId: string },
  ) {
    const conversation = await this.chatService.createConversation(user.id, user.workspaceId, dto);
    return { data: conversation, error: null };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List user conversations with search, filtering, and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in title and messages' })
  @ApiQuery({ name: 'agentId', required: false, type: String, description: 'Filter by agent ID' })
  @ApiQuery({ name: 'modelId', required: false, type: String, description: 'Filter by model ID' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date filter (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date filter (ISO 8601)' })
  @ApiQuery({ name: 'archived', required: false, type: Boolean, description: 'Include archived (default: false)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated conversation list',
    schema: apiEnvelopeSchema({ type: 'array', items: ConversationModel }),
  })
  async listConversations(
    @Query(new ZodValidationPipe(conversationQuerySchema)) query: ConversationQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.chatService.listConversations(user.id, query);
    return { data: result.items, error: null, meta: result.meta };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Conversation details', schema: apiEnvelopeSchema(ConversationModel) })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const conversation = await this.chatService.getConversation(id, user.id);
    return { data: conversation, error: null };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50, max: 100)' })
  @ApiQuery({ name: 'before', required: false, type: String, description: 'Fetch messages before this ISO 8601 date' })
  @ApiResponse({
    status: 200,
    description: 'Paginated message list',
    schema: apiEnvelopeSchema({ type: 'array', items: MessageModel }),
  })
  async getMessages(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(messageQuerySchema)) query: MessageQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.chatService.getMessages(id, user.id, query);
    return { data: result.items, error: null, meta: result.meta };
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Update conversation title' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiBody({ schema: { type: 'object', properties: { title: { type: 'string', maxLength: 200 } }, required: ['title'] } })
  @ApiResponse({ status: 200, description: 'Conversation updated', schema: apiEnvelopeSchema(ConversationModel) })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async updateConversation(
    @Param('id') id: string,
    @Body('title') title: string,
    @CurrentUser() user: { id: string },
  ) {
    const conversation = await this.chatService.updateConversationTitle(id, user.id, title);
    return { data: conversation, error: null };
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.chatService.deleteConversation(id, user.id);
    return { data: { deleted: true }, error: null };
  }

  @Patch('conversations/:id/archive')
  @ApiOperation({ summary: 'Archive a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Conversation archived', schema: apiEnvelopeSchema(ConversationModel) })
  async archiveConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const conversation = await this.chatService.archiveConversation(id, user.id);
    return { data: conversation, error: null };
  }

  @Patch('conversations/:id/unarchive')
  @ApiOperation({ summary: 'Unarchive a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Conversation unarchived', schema: apiEnvelopeSchema(ConversationModel) })
  async unarchiveConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const conversation = await this.chatService.unarchiveConversation(id, user.id);
    return { data: conversation, error: null };
  }

  @Get('conversations/:id/export')
  @ApiOperation({ summary: 'Export a conversation as JSON or Markdown' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'md'], description: 'Export format (default: json)' })
  @ApiResponse({ status: 200, description: 'Downloadable conversation export (application/json or text/markdown)' })
  async exportConversation(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(exportConversationSchema)) query: ExportConversationDto,
    @Res() res: Response,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.chatService.exportConversation(id, user.id, query.format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a message and stream the assistant response via AI SDK protocol',
    description:
      'Accepts an AI SDK-compatible message array and streams the response using the UI message stream format. ' +
      'The response is a `text/event-stream` SSE stream following the Vercel AI SDK protocol.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' },
              parts: { type: 'array', items: { type: 'object' } },
            },
            required: ['role'],
          },
          description: 'AI SDK UI message array',
        },
        conversationId: { type: 'string', format: 'uuid', description: 'Existing conversation ID (optional for new)' },
        agentId: { type: 'string', format: 'uuid', description: 'Agent to converse with' },
        modelId: { type: 'string', description: 'Model identifier (e.g. gpt-4o)' },
        providerId: { type: 'string', description: 'Provider ID override' },
      },
      required: ['messages'],
    },
  })
  @ApiResponse({ status: 200, description: 'UI message stream (text/event-stream, AI SDK format)' })
  async sendMessage(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: { id: string; workspaceId: string },
  ) {
    const { messages, conversationId, agentId, modelId, providerId } = req.body;

    const { conversationId: convId, isNew } = await this.chatService.ensureConversation(
      user.id,
      user.workspaceId,
      { conversationId, agentId, modelId, providerId },
    );

    const lastUserMessage = messages?.[messages.length - 1];
    if (lastUserMessage?.role === 'user') {
      const content =
        typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : lastUserMessage.parts
              ?.filter((p: { type: string }) => p.type === 'text')
              .map((p: { text: string }) => p.text)
              .join('') ?? '';

      await this.chatService.persistUserMessage(convId, user.id, content);
    }

    const { model, system } = await this.providerService.resolveModelAndSystem(agentId, modelId, providerId);

    const uiMessages: UIMessage[] = (messages ?? []) as UIMessage[];
    const modelMessages = await convertToModelMessages(uiMessages);

    const result = streamText({
      model,
      system,
      messages: modelMessages,
      onFinish: async ({ text, usage }) => {
        const inputTokens = usage?.inputTokens ?? undefined;
        const outputTokens = usage?.outputTokens ?? undefined;
        const tokenCount = inputTokens != null && outputTokens != null
          ? inputTokens + outputTokens
          : undefined;

        await this.chatService.persistAssistantMessage(convId, text, tokenCount, inputTokens, outputTokens);

        if (isNew) {
          this.chatService.generateTitleAsync(convId);
        }
      },
    });

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        if (isNew) {
          writer.write({
            type: 'data-conversation',
            data: { conversationId: convId },
          });
        }

        writer.merge(result.toUIMessageStream());
      },
    });

    res.setHeader('X-Conversation-Id', convId);
    pipeUIMessageStreamToResponse({ stream, response: res });
  }
}
