import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmService } from './llm.service';

@Module({
  imports: [PrismaModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
