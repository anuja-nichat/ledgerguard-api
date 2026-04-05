import { Role, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/data/user.repo", () => ({
  assignUserRole: jest.fn(),
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  findUserByEmailForAuth: jest.fn(),
  findUserById: jest.fn(),
  listUsers: jest.fn(),
  updateUser: jest.fn(),
}));

jest.mock("@/data/audit-log.repo", () => ({
  createAuditLog: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
  },
}));

import { createAuditLog } from "@/data/audit-log.repo";
import {
  assignUserRole,
  createUser,
  deleteUser,
  findUserByEmailForAuth,
  findUserById,
  updateUser,
} from "@/data/user.repo";
import {
  assignRoleForAdmin,
  createUserForAdmin,
  deleteUserForAdmin,
  updateUserForAdmin,
} from "@/services/user.service";

const mockedFindUserByEmailForAuth = jest.mocked(findUserByEmailForAuth);
const mockedCreateUser = jest.mocked(createUser);
const mockedFindUserById = jest.mocked(findUserById);
const mockedUpdateUser = jest.mocked(updateUser);
const mockedAssignUserRole = jest.mocked(assignUserRole);
const mockedDeleteUser = jest.mocked(deleteUser);
const mockedCreateAuditLog = jest.mocked(createAuditLog);

describe("user audit trail", () => {
  const adminContext = {
    userId: "cm1admin0001",
    email: "admin@finance.com",
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const baseUser = {
    id: "cm1user0001",
    email: "user@finance.com",
    role: Role.VIEWER,
    status: UserStatus.ACTIVE,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes audit log for user creation", async () => {
    mockedFindUserByEmailForAuth.mockResolvedValue(null);
    mockedCreateUser.mockResolvedValue(baseUser);

    await createUserForAdmin(adminContext, {
      email: "user@finance.com",
      password: "User#1234",
      role: "viewer",
      status: "active",
    });

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        resource: "USER",
        resourceId: baseUser.id,
        actorUserId: adminContext.userId,
      }),
      expect.anything(),
    );
  });

  it("writes role-change audit log when role changes through update", async () => {
    mockedFindUserById.mockResolvedValue(baseUser);
    mockedUpdateUser.mockResolvedValue({
      ...baseUser,
      role: Role.ANALYST,
      updatedAt: new Date("2026-03-02T00:00:00.000Z"),
    });

    await updateUserForAdmin(adminContext, baseUser.id, {
      role: "analyst",
    });

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ROLE_CHANGE",
        resource: "USER",
        resourceId: baseUser.id,
      }),
      expect.anything(),
    );
  });

  it("writes audit log for explicit role assignment", async () => {
    mockedFindUserById.mockResolvedValue(baseUser);
    mockedAssignUserRole.mockResolvedValue({
      ...baseUser,
      role: Role.ADMIN,
      updatedAt: new Date("2026-03-03T00:00:00.000Z"),
    });

    await assignRoleForAdmin(adminContext, baseUser.id, {
      role: "admin",
    });

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ROLE_CHANGE",
        resource: "USER",
        resourceId: baseUser.id,
      }),
      expect.anything(),
    );
  });

  it("writes audit log for user delete", async () => {
    mockedFindUserById.mockResolvedValue(baseUser);
    mockedDeleteUser.mockResolvedValue({ id: baseUser.id });

    await deleteUserForAdmin(adminContext, baseUser.id);

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE",
        resource: "USER",
        resourceId: baseUser.id,
      }),
      expect.anything(),
    );
  });
});

