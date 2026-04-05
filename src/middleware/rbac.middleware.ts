import type { Role } from "@prisma/client";

import { assertHasRole } from "@/lib/rbac";
import type { AuthContext } from "@/types/auth";

export function requireRole(context: AuthContext, allowedRoles: readonly Role[], message?: string) {
  assertHasRole(context.role, allowedRoles, message);
}
