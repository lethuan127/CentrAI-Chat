import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProviderModule } from '../provider/provider.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [PrismaModule, ProviderModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
