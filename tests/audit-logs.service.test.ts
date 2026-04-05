import { AuditAction, AuditResource, Role, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { ForbiddenError, ValidationError } from "@/lib/error";

jest.mock("@/data/audit-log.repo", () => ({
  listAuditLogs: jest.fn(),
}));

import { listAuditLogs } from "@/data/audit-log.repo";
import { listAuditLogsForAdmin } from "@/services/audit-log.service";

const mockedListAuditLogs = jest.mocked(listAuditLogs);

describe("audit logs service", () => {
  const adminContext = {
    userId: "cm1admin0001",
    email: "admin@finance.com",
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const viewerContext = {
    userId: "cm1viewer0001",
    email: "viewer@finance.com",
    role: Role.VIEWER,
    status: UserStatus.ACTIVE,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects non-admin users", async () => {
    await expect(listAuditLogsForAdmin(viewerContext, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lists audit logs for admin with normalized filters", async () => {
    mockedListAuditLogs.mockResolvedValue({
      items: [
        {
          id: "cm1audit0001",
          action: AuditAction.CREATE,
          resource: AuditResource.USER,
          resourceId: "cm1user0001",
          actorUserId: "cm1admin0001",
          actorEmail: "admin@finance.com",
          actorRole: Role.ADMIN,
          beforeSnapshot: null,
          afterSnapshot: { email: "new-user@finance.com" },
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
      ],
      total: 1,
    });

    const result = await listAuditLogsForAdmin(adminContext, {
      page: "1",
      limit: "10",
      action: "create",
      resource: "user",
      actorUserId: "cm1admin0001",
      startDate: "2026-03-01T00:00:00.000Z",
      endDate: "2026-03-31T00:00:00.000Z",
    });

    expect(mockedListAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
        action: AuditAction.CREATE,
        resource: AuditResource.USER,
        actorUserId: "cm1admin0001",
      }),
    );

    expect(result.logs).toHaveLength(1);
    expect(result.meta).toEqual(
      expect.objectContaining({
        pagination: expect.objectContaining({
          total: 1,
          page: 1,
          limit: 10,
          pages: 1,
        }),
      }),
    );
  });

  it("rejects invalid date ranges", async () => {
    await expect(
      listAuditLogsForAdmin(adminContext, {
        startDate: "2026-03-31T00:00:00.000Z",
        endDate: "2026-03-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

