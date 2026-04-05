import { Role } from "@prisma/client";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { getEnv } from "@/lib/env";
import { UnauthorizedError } from "@/lib/error";
import type { AuthTokenPayload } from "@/types/auth";

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
    throw new UnauthorizedError("Invalid or expired token");
  }

  if (typeof decoded === "string") {
    throw new UnauthorizedError("Invalid token payload");
  }

  const { sub, email, role } = decoded;

  if (typeof sub !== "string" || typeof email !== "string" || !isRole(role)) {
    throw new UnauthorizedError("Invalid token payload");
  }

  return {
    sub,
    email,
    role,
  };
}

export function extractBearerToken(authorizationHeader: string | null): string {
  if (!authorizationHeader) {
    throw new UnauthorizedError("Missing Authorization header");
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/);
  if (scheme.toLowerCase() !== "bearer" || !token) {
    throw new UnauthorizedError("Authorization header must use Bearer token");
  }

  return token;
}
