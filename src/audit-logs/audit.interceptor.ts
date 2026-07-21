import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditLoggerService } from './audit-logger.service';
import {
  shouldAuditGetPath,
  shouldSkipAuditPath,
} from './audit-context.util';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogger: AuditLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();
    const path = req.originalUrl ?? req.url;

    if (shouldSkipAuditPath(path)) {
      return next.handle();
    }

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isExportGet = method === 'GET' && shouldAuditGetPath(path);
    if (!isMutation && !isExportGet) {
      return next.handle();
    }

    const body = req.body;

    return next.handle().pipe(
      tap((responseBody) => {
        this.auditLogger.logFromRequest(
          req,
          method,
          path,
          body,
          responseBody,
          'success',
        );
      }),
      catchError((err: unknown) => {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Error desconocido';
        this.auditLogger.logFromRequest(
          req,
          method,
          path,
          body,
          null,
          'error',
          message,
        );
        return throwError(() => err);
      }),
    );
  }
}
