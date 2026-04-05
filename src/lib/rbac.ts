import { Role } from "@prisma/client";

import { ForbiddenError } from "@/lib/error";
import type { AuthContext } from "@/types/auth";

export function hasAnyRole(role: Role, allowedRoles: readonly Role[]): boolean {
  return allowedRoles.includes(role);
}

export function assertHasRole(role: Role, allowedRoles: readonly Role[], message?: string) {
  if (!hasAnyRole(role, allowedRoles)) {
    throw new ForbiddenError(message ?? "User role does not allow this action");
  }
}

export function assertSelfOrAdmin(context: AuthContext, targetUserId: string, message?: string) {
  if (context.role === Role.ADMIN || context.userId === targetUserId) {
    return;
  }

  throw new ForbiddenError(message ?? "You can only access your own user resource");
}

export function canReadRecords(role: Role): boolean {
  return [Role.VIEWER, Role.ANALYST, Role.ADMIN].includes(role);
}

export function canReadDashboard(role: Role): boolean {
  return [Role.VIEWER, Role.ANALYST, Role.ADMIN].includes(role);
}

export function canReadInsights(role: Role): boolean {
  return role === Role.ANALYST || role === Role.ADMIN;
}

export function canWriteFinancialRecords(role: Role): boolean {
  return role === Role.ADMIN;
}

export function canManageUsers(role: Role): boolean {
  return role === Role.ADMIN;
}
