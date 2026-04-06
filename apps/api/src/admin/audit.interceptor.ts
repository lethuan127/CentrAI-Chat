import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request } from 'express';
import { AdminService } from './admin.service';

export const AUDIT_KEY = 'audit';

export interface AuditOptions {
  action: string;
  resourceType?: string;
  getResourceId?: (req: Request) => string | undefined;
}

export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminService: AdminService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditOptions | undefined>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!options) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id?: string; email?: string; workspaceId?: string } | undefined;
    const ip = req.ip || req.socket?.remoteAddress || undefined;

    const resourceId = options.getResourceId?.(req) ?? (req.params?.id as string | undefined);

    return next.handle().pipe(
      tap(() => {
        if (user?.workspaceId) {
          this.adminService.writeAuditLog({
            workspaceId: user.workspaceId,
            actorId: user.id,
            actorEmail: user.email,
            actorIp: ip,
            action: options.action,
            resourceType: options.resourceType,
            resourceId,
            status: 'success',
          });
        }
      }),
      catchError((err) => {
        if (user?.workspaceId) {
          this.adminService.writeAuditLog({
            workspaceId: user.workspaceId,
            actorId: user.id,
            actorEmail: user.email,
            actorIp: ip,
            action: options.action,
            resourceType: options.resourceType,
            resourceId,
            status: 'failure',
            metadata: { error: err instanceof Error ? err.message : 'Unknown error' },
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
