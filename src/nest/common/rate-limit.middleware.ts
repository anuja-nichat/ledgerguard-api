import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { ERROR_CODES } from "../../constants/error-codes";
import {
  consumeRateLimit,
  resolveRateLimitClient,
  resolveRateLimitPolicy,
  type RateLimitResult,
} from "../../lib/rate-limit";

function normalizeApiPath(pathname: string): string {
  if (pathname.startsWith("/api")) {
    return pathname;
  }

  if (!pathname.startsWith("/")) {
    return `/api/${pathname}`;
  }

  return `/api${pathname}`;
}

function toHeaders(request: Request): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
      continue;
    }

    if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  return headers;
}

function applyRateLimitHeaders(response: Response, result: RateLimitResult) {
  const resetAtUnixSeconds = Math.ceil(result.resetAt / 1000);

  response.setHeader("X-RateLimit-Limit", String(result.limit));
  response.setHeader("X-RateLimit-Remaining", String(result.remaining));
  response.setHeader("X-RateLimit-Reset", String(resetAtUnixSeconds));

  response.setHeader("RateLimit-Limit", String(result.limit));
  response.setHeader("RateLimit-Remaining", String(result.remaining));
  response.setHeader("RateLimit-Reset", String(result.retryAfterSeconds));
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const pathname = normalizeApiPath(request.path || request.originalUrl || "/");
    const policy = resolveRateLimitPolicy(pathname);

    if (!policy) {
      next();
      return;
    }

    const clientKey = resolveRateLimitClient(toHeaders(request));
    const result = consumeRateLimit(policy, clientKey);

    applyRateLimitHeaders(response, result);

    if (!result.allowed) {
      response.setHeader("Retry-After", String(result.retryAfterSeconds));
      response.status(429).json({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: "Too many requests. Please try again later.",
          details: [
            {
              policy: result.policyId,
              limit: result.limit,
              windowSeconds: result.windowSeconds,
              retryAfterSeconds: result.retryAfterSeconds,
            },
          ],
        },
      });
      return;
    }

    next();
  }
}