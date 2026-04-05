import { extractBearerToken, verifyAccessToken } from "@/lib/auth";
import { InactiveUserError, UnauthorizedError } from "@/lib/error";
import type { AuthContext } from "@/types/auth";
import { findUserById } from "@/data/user.repo";

export async function requireAuth(request: Request): Promise<AuthContext> {
  const token = extractBearerToken(request.headers.get("authorization"));
  const payload = verifyAccessToken(token);

  const user = await findUserById(payload.sub);
  if (!user) {
    throw new UnauthorizedError("Authenticated user no longer exists");
  }

  if (user.status !== "ACTIVE") {
    throw new InactiveUserError();
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}
