import { AuditAction, AuditResource, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { createAuditLog } from "@/data/audit-log.repo";
import {
  assignUserRole,
  createUser,
  deleteUser,
  findUserByEmailForAuth,
  findUserById,
  listUsers,
  updateUser,
} from "@/data/user.repo";
import { toAuditSnapshot } from "@/lib/audit";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/error";
import { prisma } from "@/lib/prisma";
import { parseWithSchema } from "@/lib/request";
import { canManageUsers } from "@/lib/rbac";
import type { AuthContext } from "@/types/auth";

const roleSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toUpperCase() : value),
  z.nativeEnum(Role),
);

const statusSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toUpperCase() : value),
  z.nativeEnum(UserStatus),
);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: roleSchema.optional(),
  status: statusSchema.optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: roleSchema.default(Role.VIEWER),
  status: statusSchema.default(UserStatus.ACTIVE),
});

export const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: roleSchema.optional(),
    status: statusSchema.optional(),
  })
  .refine(
    (input) =>
      input.email !== undefined ||
      input.password !== undefined ||
      input.role !== undefined ||
      input.status !== undefined,
    "At least one field is required",
  );

export const assignRoleSchema = z.object({
  role: roleSchema,
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

function assertAdmin(context: AuthContext) {
  if (!canManageUsers(context.role)) {
    throw new ForbiddenError("Only admin users can manage user resources");
  }
}

function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function listUsersForAdmin(context: AuthContext, rawQuery: unknown) {
  assertAdmin(context);

  const query = parseWithSchema(listUsersQuerySchema, rawQuery, "User query parameters are invalid");
  const result = await listUsers(query);

  return {
    users: result.items,
    meta: buildPaginationMeta(query.page, query.limit, result.total),
  };
}

export async function createUserForAdmin(context: AuthContext, rawInput: unknown) {
  assertAdmin(context);

  const input = parseWithSchema(createUserSchema, rawInput, "Create user payload is invalid");

  const existing = await findUserByEmailForAuth(input.email);
  if (existing) {
    throw new ConflictError("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await createUser(
      {
        email: input.email,
        password: passwordHash,
        role: input.role,
        status: input.status,
      },
      tx,
    );

    await createAuditLog(
      {
        action: AuditAction.CREATE,
        resource: AuditResource.USER,
        resourceId: createdUser.id,
        actorUserId: context.userId,
        actorEmail: context.email,
        actorRole: context.role,
        afterSnapshot: toAuditSnapshot(createdUser),
      },
      tx,
    );

    return createdUser;
  });

  return { user };
}

export async function getUserByIdForContext(context: AuthContext, userId: string) {
  if (context.role !== Role.ADMIN && context.userId !== userId) {
    throw new ForbiddenError("You can only view your own user profile");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  return { user };
}

export async function updateUserForAdmin(context: AuthContext, userId: string, rawInput: unknown) {
  assertAdmin(context);

  const input = parseWithSchema(updateUserSchema, rawInput, "Update user payload is invalid");
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;

  const user = await prisma.$transaction(async (tx) => {
    const existingUser = await findUserById(userId, tx);
    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    if (context.userId === userId) {
      if (input.role && input.role !== Role.ADMIN) {
        throw new BusinessRuleError("Admin cannot demote their own role");
      }

      if (input.status === UserStatus.INACTIVE) {
        throw new BusinessRuleError("Admin cannot deactivate their own account");
      }
    }

    if (input.email) {
      const userWithEmail = await findUserByEmailForAuth(input.email, tx);
      if (userWithEmail && userWithEmail.id !== userId) {
        throw new ConflictError("A user with this email already exists");
      }
    }

    const updatedUser = await updateUser(
      userId,
      {
        email: input.email,
        password: passwordHash,
        role: input.role,
        status: input.status,
      },
      tx,
    );

    const action =
      input.role !== undefined && input.role !== existingUser.role
        ? AuditAction.ROLE_CHANGE
        : AuditAction.UPDATE;

    await createAuditLog(
      {
        action,
        resource: AuditResource.USER,
        resourceId: userId,
        actorUserId: context.userId,
        actorEmail: context.email,
        actorRole: context.role,
        beforeSnapshot: toAuditSnapshot(existingUser),
        afterSnapshot: toAuditSnapshot(updatedUser),
      },
      tx,
    );

    return updatedUser;
  });

  return { user };
}

export async function deleteUserForAdmin(context: AuthContext, userId: string) {
  assertAdmin(context);

  if (context.userId === userId) {
    throw new BusinessRuleError("Admin cannot delete their own account");
  }

  await prisma.$transaction(async (tx) => {
    const existingUser = await findUserById(userId, tx);
    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    await deleteUser(userId, tx);

    await createAuditLog(
      {
        action: AuditAction.DELETE,
        resource: AuditResource.USER,
        resourceId: userId,
        actorUserId: context.userId,
        actorEmail: context.email,
        actorRole: context.role,
        beforeSnapshot: toAuditSnapshot(existingUser),
      },
      tx,
    );
  });
}

export async function assignRoleForAdmin(context: AuthContext, userId: string, rawInput: unknown) {
  assertAdmin(context);

  const input = parseWithSchema(assignRoleSchema, rawInput, "Role assignment payload is invalid");
  const user = await prisma.$transaction(async (tx) => {
    const existingUser = await findUserById(userId, tx);
    if (!existingUser) {
      throw new NotFoundError("User not found");
    }

    if (context.userId === userId && input.role !== Role.ADMIN) {
      throw new BusinessRuleError("Admin cannot demote their own role");
    }

    const updatedUser = await assignUserRole(userId, input.role, tx);

    await createAuditLog(
      {
        action: AuditAction.ROLE_CHANGE,
        resource: AuditResource.USER,
        resourceId: userId,
        actorUserId: context.userId,
        actorEmail: context.email,
        actorRole: context.role,
        beforeSnapshot: toAuditSnapshot(existingUser),
        afterSnapshot: toAuditSnapshot(updatedUser),
      },
      tx,
    );

    return updatedUser;
  });

  return { user };
}
