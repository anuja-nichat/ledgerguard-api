import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { AuthContext } from "../../types/auth";
import { ApiUnauthorizedError } from "./api-http-error";

export const CurrentAuthContext = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const request = ctx.switchToHttp().getRequest<Request>();

  if (!request.authContext) {
    throw new ApiUnauthorizedError("Authentication context is unavailable");
  }

  return request.authContext;
});