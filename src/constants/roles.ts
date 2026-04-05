import { Role } from "@prisma/client";

export const ADMIN_ROLES = [Role.ADMIN] as const;
export const ANALYST_OR_ADMIN_ROLES = [Role.ANALYST, Role.ADMIN] as const;
export const ALL_AUTHENTICATED_ROLES = [Role.VIEWER, Role.ANALYST, Role.ADMIN] as const;
