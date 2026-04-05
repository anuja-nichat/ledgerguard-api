import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { prisma } from "../../lib/prisma";
import { extractBearerToken, verifyAccessToken } from "../auth/jwt";
import { ApiInactiveUserError, ApiUnauthorizedError } from "./api-http-error";

@Injectable()
export class AuthContextGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawAuthorization = request.headers.authorization;
    const authorizationHeader = Array.isArray(rawAuthorization)
      ? rawAuthorization[0]
      : rawAuthorization;

    const token = extractBearerToken(authorizationHeader);
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new ApiUnauthorizedError("Authenticated user no longer exists");
    }

    if (user.status !== "ACTIVE") {
      throw new ApiInactiveUserError();
    }

    request.authContext = {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return true;
  }
}