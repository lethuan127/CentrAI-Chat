---
name: scaffold-nestjs-module
description: >-
  Scaffold a new NestJS feature module in apps/api with controller, service,
  module, Zod DTOs, Prisma model, and barrel export. Use when creating a new
  backend feature, adding a new API resource, or when the user says "create
  module", "add endpoint", "new resource", or "scaffold API".
---

# Scaffold NestJS Module

Create a new feature module in `apps/api/src/` following the project's established patterns.

## Steps

### 1. Add Prisma Model

Add the model to `apps/api/prisma/schema.prisma` following existing conventions:

```prisma
model ResourceName {
  id          String    @id @default(uuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  // ... domain fields
  createdBy   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  @@index([workspaceId])
  @@map("resource_names")  // plural, snake_case
}
```

Then update the `Workspace` model to add the reverse relation. Run `pnpm prisma migrate dev --name add-resource-name`.

### 2. Add Zod Schemas to `packages/types`

Add schemas in `packages/types/src/api.ts` (DTOs) and `packages/types/src/models.ts` (domain entity):

```typescript
// models.ts — domain schema
export const resourceNameSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  // ... fields matching Prisma model
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ResourceName = z.infer<typeof resourceNameSchema>;

// api.ts — request DTOs
export const createResourceNameSchema = z.object({
  name: z.string().min(1).max(100),
  // ... only writable fields
});
export type CreateResourceNameDto = z.infer<typeof createResourceNameSchema>;

export const updateResourceNameSchema = createResourceNameSchema.partial();
export type UpdateResourceNameDto = z.infer<typeof updateResourceNameSchema>;
```

Re-export from `packages/types/src/index.ts`.

### 3. Create Module Files

Create these files in `apps/api/src/{module-name}/`:

**`{name}.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { ResourceNameService } from './resource-name.service';
import { ResourceNameController } from './resource-name.controller';

@Module({
  controllers: [ResourceNameController],
  providers: [ResourceNameService],
  exports: [ResourceNameService],
})
export class ResourceNameModule {}
```

**`{name}.service.ts`**
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateResourceNameDto, UpdateResourceNameDto } from '@centrai/types';

@Injectable()
export class ResourceNameService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateResourceNameDto) { /* ... */ }
  async findAll(filters: { workspaceId: string }) { /* ... */ }
  async findOne(id: string) { /* ... throw NotFoundException */ }
  async update(id: string, dto: UpdateResourceNameDto) { /* ... */ }
  async remove(id: string) { /* soft delete: set deletedAt */ }
}
```

**`{name}.controller.ts`** — follow `auth.controller.ts` pattern:
```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { createResourceNameSchema, updateResourceNameSchema } from '@centrai/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ResourceNameService } from './resource-name.service';

@ApiTags('ResourceName')
@ApiBearerAuth()
@Controller('resource-names')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResourceNameController {
  constructor(private readonly service: ResourceNameService) {}

  @Post()
  @Roles('ADMIN', 'DEVELOPER')
  @UsePipes(new ZodValidationPipe(createResourceNameSchema))
  @ApiOperation({ summary: 'Create resource name' })
  async create(@Body() dto, @CurrentUser() user) {
    return { data: await this.service.create(user.id, dto), error: null };
  }

  // GET, PATCH, DELETE follow same pattern...
}
```

**`index.ts`** — barrel export:
```typescript
export { ResourceNameModule } from './resource-name.module';
export { ResourceNameService } from './resource-name.service';
```

### 4. Register Module

Add the module to `apps/api/src/app.module.ts` imports array.

### 5. RBAC Checklist

| Endpoint | Admin | Developer | User |
|----------|-------|-----------|------|
| `POST /resource-names` | yes | yes | — |
| `GET /resource-names` | yes | yes | yes |
| `PATCH /resource-names/:id` | yes | yes | — |
| `DELETE /resource-names/:id` | yes | yes | — |

Adjust `@Roles()` decorators per this matrix. End-user-only read endpoints should omit `@Roles()` but keep `@UseGuards(JwtAuthGuard)`.

### 6. Response Format

All responses use the project envelope:

```typescript
return { data: result, error: null };
```

Errors are handled by the global `HttpExceptionFilter` in `common/filters/`.
