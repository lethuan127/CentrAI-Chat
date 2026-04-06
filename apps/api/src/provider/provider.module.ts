import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProviderService } from './provider.service';
import { ProviderAdminService } from './provider-admin.service';
import { ProviderAdminController } from './provider-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProviderAdminController],
  providers: [ProviderService, ProviderAdminService],
  exports: [ProviderService, ProviderAdminService],
})
export class ProviderModule {}
