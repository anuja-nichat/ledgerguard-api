import { Prisma, PrismaClient, type RecordType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | PrismaClient;

const financialRecordSelect = {
  id: true,
  userId: true,
  type: true,
  amount: true,
  currencyCode: true,
  currencySymbol: true,
  category: true,
  date: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
    },
  },
} satisfies Prisma.FinancialRecordSelect;

export type FinancialRecordEntity = Prisma.FinancialRecordGetPayload<{
  select: typeof financialRecordSelect;
}>;

export type ListFinancialRecordsInput = {
  page: number;
  limit: number;
  type?: RecordType;
  currencyCode?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
};

export type ListDeletedFinancialRecordsInput = {
  page: number;
  limit: number;
  userId?: string;
};

function buildFinancialRecordWhere(input: {
  type?: RecordType;
  currencyCode?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  includeDeleted?: boolean;
}): Prisma.FinancialRecordWhereInput {
  const where: Prisma.FinancialRecordWhereInput = {};

  if (!input.includeDeleted) {
    where.deletedAt = null;
  }

  if (input.userId) {
    where.userId = input.userId;
  }

  if (input.type) {
    where.type = input.type;
  }

  if (input.currencyCode) {
    where.currencyCode = input.currencyCode;
  }

  if (input.category) {
    where.category = {
      contains: input.category,
      mode: "insensitive",
    };
  }

  if (input.startDate || input.endDate) {
    where.date = {
      gte: input.startDate,
      lte: input.endDate,
    };
  }

  return where;
}

export async function listFinancialRecords(input: ListFinancialRecordsInput) {
  const where = buildFinancialRecordWhere(input);
  const skip = (input.page - 1) * input.limit;

  const [items, total] = await prisma.$transaction([
    prisma.financialRecord.findMany({
      where,
      select: financialRecordSelect,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: input.limit,
    }),
    prisma.financialRecord.count({ where }),
  ]);

  return {
    items,
    total,
  };
}

export async function listDeletedFinancialRecords(input: ListDeletedFinancialRecordsInput) {
  const where: Prisma.FinancialRecordWhereInput = {
    deletedAt: {
      not: null,
    },
    userId: input.userId,
  };

  const skip = (input.page - 1) * input.limit;

  const [items, total] = await prisma.$transaction([
    prisma.financialRecord.findMany({
      where,
      select: financialRecordSelect,
      orderBy: [{ deletedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: input.limit,
    }),
    prisma.financialRecord.count({ where }),
  ]);

  return {
    items,
    total,
  };
}

export async function findFinancialRecordById(id: string, db: DbClient = prisma) {
  return db.financialRecord.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: financialRecordSelect,
  });
}

export async function findDeletedFinancialRecordById(id: string) {
  return prisma.financialRecord.findFirst({
    where: {
      id,
      deletedAt: {
        not: null,
      },
    },
    select: financialRecordSelect,
  });
}

export async function createFinancialRecord(input: {
  userId: string;
  type: RecordType;
  amount: number;
  currencyCode: string;
  currencySymbol: string;
  category: string;
  date: Date;
  notes?: string;
}, db: DbClient = prisma) {
  return db.financialRecord.create({
    data: input,
    select: financialRecordSelect,
  });
}

export async function updateFinancialRecord(
  id: string,
  input: {
    userId?: string;
    type?: RecordType;
    amount?: number;
    currencyCode?: string;
    currencySymbol?: string;
    category?: string;
    date?: Date;
    notes?: string;
  },
  db: DbClient = prisma,
) {
  return db.financialRecord.update({
    where: { id },
    data: input,
    select: financialRecordSelect,
  });
}

export async function softDeleteFinancialRecord(id: string, db: DbClient = prisma) {
  return db.financialRecord.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
    select: financialRecordSelect,
  });
}

export async function restoreFinancialRecord(id: string) {
  return prisma.financialRecord.updateMany({
    where: {
      id,
      deletedAt: {
        not: null,
      },
    },
    data: {
      deletedAt: null,
    },
  });
}

export async function purgeExpiredSoftDeletedFinancialRecords(cutoffDate: Date) {
  return prisma.financialRecord.deleteMany({
    where: {
      deletedAt: {
        not: null,
        lte: cutoffDate,
      },
    },
  });
}
