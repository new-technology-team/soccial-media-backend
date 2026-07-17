import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, Record<string, unknown>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Record<string, unknown>> {
    const now = new Date().toISOString();
    return next.handle().pipe(
      map((data) => {
        const resp = context.switchToHttp().getResponse();
        if (resp.headersSent) return data as any;

        if (data !== null && data !== undefined && typeof data === 'object' && !Array.isArray(data)) {
          const obj = data as Record<string, unknown>;
          return { ...obj, success: true, timestamp: now };
        }

        return { data, success: true, timestamp: now };
      }),
    );
  }
}
