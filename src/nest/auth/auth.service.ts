import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "../../lib/prisma";
import {
  ApiInactiveUserError,
  ApiUnauthorizedError,
  ApiValidationError,
} from "../common/api-http-error";
import { issueAccessToken } from "./jwt";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;

function formatZodIssues(error: z.ZodError): unknown[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export class AuthService {
  validateLoginPayload(payload: unknown): LoginInput {
    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiValidationError("Login payload is invalid", formatZodIssues(parsed.error));
    }

    return parsed.data;
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new ApiUnauthorizedError("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.password);
    if (!passwordMatches) {
      throw new ApiUnauthorizedError("Invalid email or password");
    }

    if (user.status !== "ACTIVE") {
      throw new ApiInactiveUserError();
    }

    const accessToken = issueAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      tokenType: "Bearer",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }
}