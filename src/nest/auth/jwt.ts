import { Role } from "@prisma/client";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { getEnv } from "../../lib/env";
import type { AuthTokenPayload } from "../../types/auth";
import { ApiUnauthorizedError } from "../common/api-http-error";

function isRole(value: unknown): value is Role {
  return Object.values(Role).includes(value as Role);
}

export function issueAccessToken(payload: AuthTokenPayload): string {
  const env = getEnv();

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const env = getEnv();

  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiUnauthorizedError("Invalid or expired token");
  }

  if (typeof decoded === "string") {
    throw new ApiUnauthorizedError("Invalid token payload");
  }

  const { sub, email, role } = decoded;
  if (typeof sub !== "string" || typeof email !== "string" || !isRole(role)) {
    throw new ApiUnauthorizedError("Invalid token payload");
  }

  return {
    sub,
    email,
    role,
  };
}

export function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    throw new ApiUnauthorizedError("Missing Authorization header");
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/);
  if (scheme.toLowerCase() !== "bearer" || !token) {
    throw new ApiUnauthorizedError("Authorization header must use Bearer token");
  }

  return token;
}