import bcrypt from "bcryptjs";
import { z } from "zod";

import { findUserByEmailForAuth } from "@/data/user.repo";
import { issueAccessToken } from "@/lib/auth";
import { InactiveUserError, UnauthorizedError } from "@/lib/error";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;

export async function login(input: LoginInput) {
  const user = await findUserByEmailForAuth(input.email);
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);
  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    throw new InactiveUserError();
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
