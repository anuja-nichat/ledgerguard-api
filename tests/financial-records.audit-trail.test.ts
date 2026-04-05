import { RecordType, Role, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/data/financial-record.repo", () => ({
  createFinancialRecord: jest.fn(),
  findDeletedFinancialRecordById: jest.fn(),
  findFinancialRecordById: jest.fn(),
  listDeletedFinancialRecords: jest.fn(),
  listFinancialRecords: jest.fn(),
  purgeExpiredSoftDeletedFinancialRecords: jest.fn(),
  restoreFinancialRecord: jest.fn(),
  softDeleteFinancialRecord: jest.fn(),
  updateFinancialRecord: jest.fn(),
}));

jest.mock("@/data/user.repo", () => ({
  findUserById: jest.fn(),
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
  createFinancialRecord,
  findFinancialRecordById,
  purgeExpiredSoftDeletedFinancialRecords,
  softDeleteFinancialRecord,
  updateFinancialRecord,
} from "@/data/financial-record.repo";
import { findUserById } from "@/data/user.repo";
import {
  createFinancialRecordForContext,
  deleteFinancialRecordForContext,
  updateFinancialRecordForContext,
} from "@/services/financial-records.service";

const mockedFindUserById = jest.mocked(findUserById);
const mockedCreateFinancialRecord = jest.mocked(createFinancialRecord);
const mockedUpdateFinancialRecord = jest.mocked(updateFinancialRecord);
const mockedFindFinancialRecordById = jest.mocked(findFinancialRecordById);
const mockedSoftDeleteFinancialRecord = jest.mocked(softDeleteFinancialRecord);
const mockedPurgeExpired = jest.mocked(purgeExpiredSoftDeletedFinancialRecords);
const mockedCreateAuditLog = jest.mocked(createAuditLog);

function decimal(value: number) {
  return {
    toString: () => value.toFixed(2),
  };
}

describe("financial record audit trail", () => {
  const adminContext = {
    userId: "cm1admin0001",
    email: "admin@finance.com",
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const baseRecord = {
    id: "cm1record0001",
    userId: "cm1user0001",
    type: RecordType.EXPENSE,
    amount: decimal(1200),
    currencyCode: "INR",
    currencySymbol: "â‚¹",
    category: "Operations",
    date: new Date("2026-03-05T00:00:00.000Z"),
    notes: "Vendor invoice",
    createdAt: new Date("2026-03-05T00:00:00.000Z"),
    updatedAt: new Date("2026-03-05T00:00:00.000Z"),
    deletedAt: null,
    user: {
      id: "cm1user0001",
      email: "analyst@finance.com",
      role: Role.ANALYST,
      status: UserStatus.ACTIVE,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPurgeExpired.mockResolvedValue({ count: 0 });
  });

  it("writes audit log for record create", async () => {
    mockedFindUserById.mockResolvedValue({
      id: "cm1user0001",
      email: "analyst@finance.com",
      role: Role.ANALYST,
      status: UserStatus.ACTIVE,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    mockedCreateFinancialRecord.mockResolvedValue(baseRecord as never);

    await createFinancialRecordForContext(adminContext, {
      type: "expense",
      amount: 1200,
      category: "Operations",
      date: "2026-03-05T00:00:00.000Z",
      userId: "cm1user0001",
    });

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        resource: "FINANCIAL_RECORD",
        resourceId: baseRecord.id,
        actorUserId: adminContext.userId,
      }),
      expect.anything(),
    );
  });

  it("writes audit log for record update", async () => {
    mockedFindFinancialRecordById.mockResolvedValue(baseRecord as never);
    mockedUpdateFinancialRecord.mockResolvedValue({
      ...baseRecord,
      category: "Updated Category",
      updatedAt: new Date("2026-03-06T00:00:00.000Z"),
    } as never);

    await updateFinancialRecordForContext(adminContext, baseRecord.id, {
      category: "Updated Category",
    });

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        resource: "FINANCIAL_RECORD",
        resourceId: baseRecord.id,
      }),
      expect.anything(),
    );
  });

  it("writes audit log for record delete", async () => {
    mockedFindFinancialRecordById.mockResolvedValue(baseRecord as never);
    mockedSoftDeleteFinancialRecord.mockResolvedValue({
      ...baseRecord,
      deletedAt: new Date("2026-03-06T00:00:00.000Z"),
      updatedAt: new Date("2026-03-06T00:00:00.000Z"),
    } as never);

    await deleteFinancialRecordForContext(adminContext, baseRecord.id);

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE",
        resource: "FINANCIAL_RECORD",
        resourceId: baseRecord.id,
      }),
      expect.anything(),
    );
  });
});

