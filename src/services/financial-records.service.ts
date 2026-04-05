import { AuditAction, AuditResource, RecordType, Role } from "@prisma/client";
import { z } from "zod";

import { createAuditLog } from "@/data/audit-log.repo";
import {
  createFinancialRecord,
  findDeletedFinancialRecordById,
  findFinancialRecordById,
  listDeletedFinancialRecords,
  listFinancialRecords,
  purgeExpiredSoftDeletedFinancialRecords,
  restoreFinancialRecord,
  softDeleteFinancialRecord,
  updateFinancialRecord,
  type FinancialRecordEntity,
} from "@/data/financial-record.repo";
import { findUserById } from "@/data/user.repo";
import { toAuditSnapshot } from "@/lib/audit";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/lib/error";
import { prisma } from "@/lib/prisma";
import { parseWithSchema } from "@/lib/request";
import { canReadRecords, canWriteFinancialRecords } from "@/lib/rbac";
import type { AuthContext } from "@/types/auth";

const DEFAULT_CURRENCY_CODE = "INR";
const DEFAULT_CURRENCY_SYMBOL = "₹";
export const RECYCLE_BIN_RETENTION_DAYS = 30;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const recordTypeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toUpperCase() : value),
  z.nativeEnum(RecordType),
);

const currencyCodeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.string().regex(/^[A-Z]{3}$/, "currencyCode must be a 3-letter code"),
);

const listCurrencyCodeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.enum(["INR", "USD"]),
);

const currencySymbolSchema = z.string().trim().min(1).max(8);

const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Must be a valid date string",
});

export const listFinancialRecordsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: recordTypeSchema.optional(),
    currencyCode: listCurrencyCodeSchema.optional(),
    category: z.string().trim().min(1).max(80).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    userId: z.string().cuid().optional(),
  })
  .refine(
    (value) => {
      if (!value.startDate || !value.endDate) {
        return true;
      }

      return new Date(value.startDate) <= new Date(value.endDate);
    },
    {
      message: "startDate must be before or equal to endDate",
      path: ["startDate"],
    },
  );

export const createFinancialRecordSchema = z.object({
  type: recordTypeSchema,
  amount: z.number().positive(),
  currencyCode: currencyCodeSchema.optional(),
  currencySymbol: currencySymbolSchema.optional(),
  category: z.string().trim().min(1).max(80),
  date: dateStringSchema,
  notes: z.string().trim().max(500).optional(),
  userId: z.string().cuid().optional(),
}).refine(
  (input) =>
    (input.currencyCode === undefined && input.currencySymbol === undefined) ||
    (input.currencyCode !== undefined && input.currencySymbol !== undefined),
  {
    message: "currencyCode and currencySymbol must be provided together",
    path: ["currencyCode"],
  },
);

export const updateFinancialRecordSchema = z
  .object({
    type: recordTypeSchema.optional(),
    amount: z.number().positive().optional(),
    currencyCode: currencyCodeSchema.optional(),
    currencySymbol: currencySymbolSchema.optional(),
    category: z.string().trim().min(1).max(80).optional(),
    date: dateStringSchema.optional(),
    notes: z.string().trim().max(500).optional(),
    userId: z.string().cuid().optional(),
  })
  .refine(
    (input) =>
      input.type !== undefined ||
      input.amount !== undefined ||
      input.currencyCode !== undefined ||
      input.currencySymbol !== undefined ||
      input.category !== undefined ||
      input.date !== undefined ||
      input.notes !== undefined ||
      input.userId !== undefined,
    "At least one field is required",
  )
  .refine(
    (input) =>
      (input.currencyCode === undefined && input.currencySymbol === undefined) ||
      (input.currencyCode !== undefined && input.currencySymbol !== undefined),
    {
      message: "currencyCode and currencySymbol must be provided together",
      path: ["currencyCode"],
    },
  );

export const listDeletedFinancialRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().cuid().optional(),
});

function parseDateOrUndefined(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

function assertRecordDate(date: Date) {
  if (date > new Date()) {
    throw new BusinessRuleError("Record date cannot be in the future");
  }
}

function resolveCurrency(input: { currencyCode?: string; currencySymbol?: string }) {
  return {
    currencyCode: input.currencyCode ?? DEFAULT_CURRENCY_CODE,
    currencySymbol: input.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL,
  };
}

function mapRecord(record: FinancialRecordEntity) {
  const amount = Number(record.amount.toString());

  return {
    ...record,
    amount,
    amountDisplay: `${record.currencySymbol}${amount.toFixed(2)}`,
  };
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

export function getRecycleBinExpiresAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + RECYCLE_BIN_RETENTION_DAYS * DAY_IN_MILLISECONDS);
}

export function isRecycleBinExpired(deletedAt: Date, now = new Date()): boolean {
  return now.getTime() >= getRecycleBinExpiresAt(deletedAt).getTime();
}

export function getRecycleBinDaysRemaining(deletedAt: Date, now = new Date()): number {
  const remainingMilliseconds = getRecycleBinExpiresAt(deletedAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(remainingMilliseconds / DAY_IN_MILLISECONDS));
}

export function getRecycleBinCutoffDate(now = new Date()): Date {
  return new Date(now.getTime() - RECYCLE_BIN_RETENTION_DAYS * DAY_IN_MILLISECONDS);
}

async function purgeExpiredRecycleBinItems() {
  return purgeExpiredSoftDeletedFinancialRecords(getRecycleBinCutoffDate());
}

function mapDeletedRecordForRecycleBin(record: FinancialRecordEntity) {
  const deletedAt = record.deletedAt ?? record.updatedAt;

  return {
    ...mapRecord(record),
    deletedAt,
    recycleBinExpiresAt: getRecycleBinExpiresAt(deletedAt),
    recycleBinDaysRemaining: getRecycleBinDaysRemaining(deletedAt),
  };
}

export async function listFinancialRecordsForContext(context: AuthContext, rawQuery: unknown) {
  if (!canReadRecords(context.role)) {
    throw new ForbiddenError("Current role cannot read financial records");
  }

  await purgeExpiredRecycleBinItems();

  const query = parseWithSchema(
    listFinancialRecordsQuerySchema,
    rawQuery,
    "Financial record query parameters are invalid",
  );

  if (context.role !== Role.ADMIN && query.userId && query.userId !== context.userId) {
    throw new ForbiddenError("Non-admin users can only view their own records");
  }

  const scopedUserId = context.role === Role.ADMIN ? query.userId : context.userId;
  const result = await listFinancialRecords({
    page: query.page,
    limit: query.limit,
    type: query.type,
    currencyCode: query.currencyCode,
    category: query.category,
    startDate: parseDateOrUndefined(query.startDate),
    endDate: parseDateOrUndefined(query.endDate),
    userId: scopedUserId,
  });

  return {
    records: result.items.map(mapRecord),
    meta: buildPaginationMeta(query.page, query.limit, result.total),
  };
}

export async function createFinancialRecordForContext(context: AuthContext, rawInput: unknown) {
  if (!canWriteFinancialRecords(context.role)) {
    throw new ForbiddenError("Current role cannot create financial records");
  }

  await purgeExpiredRecycleBinItems();

  const input = parseWithSchema(
    createFinancialRecordSchema,
    rawInput,
    "Create financial record payload is invalid",
  );

  const recordDate = new Date(input.date);
  assertRecordDate(recordDate);
  const currency = resolveCurrency(input);

  const targetUserId = input.userId ?? context.userId;
  const targetUser = await findUserById(targetUserId);
  if (!targetUser) {
    throw new NotFoundError("Target user for financial record was not found");
  }

  const record = await prisma.$transaction(async (tx) => {
    const createdRecord = await createFinancialRecord(
      {
        userId: targetUserId,
        type: input.type,
        amount: input.amount,
        currencyCode: currency.currencyCode,
        currencySymbol: currency.currencySymbol,
        category: input.category,
        date: recordDate,
        notes: input.notes,
      },
      tx,
    );

    await createAuditLog(
      {
        action: AuditAction.CREATE,
        resource: AuditResource.FINANCIAL_RECORD,
        resourceId: createdRecord.id,
        actorUserId: context.userId,
        actorEmail: context.email,
        actorRole: context.role,
        afterSnapshot: toAuditSnapshot(mapRecord(createdRecord)),
      },
      tx,
    );

    return createdRecord;
  });

  return {
    record: mapRecord(record),
  };
}

export async function getFinancialRecordByIdForContext(context: AuthContext, recordId: string) {
  if (!canReadRecords(context.role)) {
    throw new ForbiddenError("Current role cannot read financial records");
  }

  await purgeExpiredRecycleBinItems();

  const record = await findFinancialRecordById(recordId);
  if (!record) {
    throw new NotFoundError("Financial record was not found");
  }

  if (context.role !== Role.ADMIN && record.userId !== context.userId) {
    throw new ForbiddenError("Non-admin users can only view their own records");
  }

  return {
    record: mapRecord(record),
  };
}

export async function updateFinancialRecordForContext(
  context: AuthContext,
  recordId: string,
  rawInput: unknown,
) {
  if (!canWriteFinancialRecords(context.role)) {
    throw new ForbiddenError("Current role cannot update financial records");
  }

  await purgeExpiredRecycleBinItems();

  const input = parseWithSchema(
    updateFinancialRecordSchema,
    rawInput,
    "Update financial record payload is invalid",
  );

  const updatedRecord = await prisma.$transaction(async (tx) => {
    const existingRecord = await findFinancialRecordById(recordId, tx);
    if (!existingRecord) {
      throw new NotFoundError("Financial record was not found");
    }

    if (input.date) {
      assertRecordDate(new Date(input.date));
    }

    if (input.userId) {
      const targetUser = await findUserById(input.userId, tx);
      if (!targetUser) {
        throw new NotFoundError("Target user for financial record was not found");
      }
    }

    const updated = await updateFinancialRecord(
      recordId,
      {
        type: input.type,
        amount: input.amount,
        currencyCode: input.currencyCode,
        currencySymbol: input.currencySymbol,
        category: input.category,
        date: input.date ? new Date(input.date) : undefined,
        notes: input.notes,
        userId: input.userId,
      },
      tx,
    );

    await createAuditLog(
      {
        action: AuditAction.UPDATE,
        resource: AuditResource.FINANCIAL_RECORD,
        resourceId: recordId,
        actorUserId: context.userId,
        actorEmail: context.email,
        actorRole: context.role,
        beforeSnapshot: toAuditSnapshot(mapRecord(existingRecord)),
        afterSnapshot: toAuditSnapshot(mapRecord(updated)),
      },
      tx,
    );

    return updated;
  });

  return {
    record: mapRecord(updatedRecord),
  };
}

export async function deleteFinancialRecordForContext(context: AuthContext, recordId: string) {
  if (!canWriteFinancialRecords(context.role)) {
    throw new ForbiddenError("Current role cannot delete financial records");
  }

  await purgeExpiredRecycleBinItems();

  await prisma.$transaction(async (tx) => {
    const existingRecord = await findFinancialRecordById(recordId, tx);
    if (!existingRecord) {
      throw new NotFoundError("Financial record was not found");
    }

    const deletedRecord = await softDeleteFinancialRecord(recordId, tx);

    await createAuditLog(
      {
        action: AuditAction.DELETE,
        resource: AuditResource.FINANCIAL_RECORD,
        resourceId: recordId,
        actorUserId: context.userId,
        actorEmail: context.email,
        actorRole: context.role,
        beforeSnapshot: toAuditSnapshot(mapRecord(existingRecord)),
        afterSnapshot: toAuditSnapshot(mapRecord(deletedRecord)),
      },
      tx,
    );
  });
}

export async function listDeletedFinancialRecordsForContext(context: AuthContext, rawQuery: unknown) {
  if (!canWriteFinancialRecords(context.role)) {
    throw new ForbiddenError("Current role cannot access the financial record recycle bin");
  }

  await purgeExpiredRecycleBinItems();

  const query = parseWithSchema(
    listDeletedFinancialRecordsQuerySchema,
    rawQuery,
    "Recycle bin query parameters are invalid",
  );

  const result = await listDeletedFinancialRecords({
    page: query.page,
    limit: query.limit,
    userId: query.userId,
  });

  return {
    records: result.items.map(mapDeletedRecordForRecycleBin),
    meta: {
      ...buildPaginationMeta(query.page, query.limit, result.total),
      retentionDays: RECYCLE_BIN_RETENTION_DAYS,
    },
  };
}

export async function restoreFinancialRecordForContext(context: AuthContext, recordId: string) {
  if (!canWriteFinancialRecords(context.role)) {
    throw new ForbiddenError("Current role cannot restore financial records");
  }

  await purgeExpiredRecycleBinItems();

  const deletedRecord = await findDeletedFinancialRecordById(recordId);
  if (!deletedRecord || !deletedRecord.deletedAt || isRecycleBinExpired(deletedRecord.deletedAt)) {
    throw new NotFoundError("Financial record was not found in recycle bin");
  }

  const restored = await restoreFinancialRecord(recordId);
  if (restored.count === 0) {
    throw new NotFoundError("Financial record was not found in recycle bin");
  }

  const record = await findFinancialRecordById(recordId);
  if (!record) {
    throw new NotFoundError("Financial record was not found after restore");
  }

  return {
    record: mapRecord(record),
  };
}

export async function purgeExpiredDeletedFinancialRecordsForContext(context: AuthContext) {
  if (!canWriteFinancialRecords(context.role)) {
    throw new ForbiddenError("Current role cannot purge recycled financial records");
  }

  const purgeResult = await purgeExpiredRecycleBinItems();

  return {
    deletedCount: purgeResult.count,
    retentionDays: RECYCLE_BIN_RETENTION_DAYS,
  };
}
