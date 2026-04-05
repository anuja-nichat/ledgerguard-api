import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import type { Response } from "express";
import { map, type Observable } from "rxjs";

const EMPTY_META: Record<string, unknown> = {};

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestPath = request.path ?? request.originalUrl ?? "";

    if (requestPath === "/api/docs" || requestPath === "/api/docs/openapi") {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (response.statusCode === 204) {
          return undefined;
        }

        if (data && typeof data === "object" && "success" in (data as Record<string, unknown>)) {
          return data;
        }

        return {
          success: true,
          data: data ?? null,
          meta: EMPTY_META,
        };
      }),
    );
  }
}