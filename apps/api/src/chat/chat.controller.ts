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
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
  createConversationSchema,
  conversationQuerySchema,
  messageQuerySchema,
} from '@centrai/types';
import type {
  CreateConversationDto,
  ConversationQueryDto,
  MessageQueryDto,
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

@ApiTags('Chat')
@ApiBearerAuth()
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
  @ApiResponse({ status: 201, description: 'Conversation created' })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: { id: string; workspaceId: string },
  ) {
    const conversation = await this.chatService.createConversation(user.id, user.workspaceId, dto);
    return { data: conversation, error: null };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List user conversations' })
  @ApiResponse({ status: 200, description: 'Paginated conversation list' })
  async listConversations(
    @Query(new ZodValidationPipe(conversationQuerySchema)) query: ConversationQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.chatService.listConversations(user.id, query);
    return { data: result.items, error: null, meta: result.meta };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const conversation = await this.chatService.getConversation(id, user.id);
    return { data: conversation, error: null };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiResponse({ status: 200, description: 'Paginated message list' })
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
  @ApiResponse({ status: 200, description: 'Conversation updated' })
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
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  async deleteConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.chatService.deleteConversation(id, user.id);
    return { data: { deleted: true }, error: null };
  }

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message and stream the assistant response via AI SDK protocol' })
  @ApiResponse({ status: 200, description: 'UI message stream (AI SDK format)' })
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

    const { model, system } = await this.providerService.resolveModelAndSystem(agentId, modelId);

    const uiMessages: UIMessage[] = (messages ?? []) as UIMessage[];
    const modelMessages = await convertToModelMessages(uiMessages);

    const result = streamText({
      model,
      system,
      messages: modelMessages,
      onFinish: async ({ text, usage }) => {
        const tokenCount = usage
          ? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
          : undefined;

        await this.chatService.persistAssistantMessage(convId, text, tokenCount);

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
