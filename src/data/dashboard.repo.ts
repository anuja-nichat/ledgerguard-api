import { Prisma, type RecordType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const recentActivitySelect = {
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
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
    },
  },
} satisfies Prisma.FinancialRecordSelect;

export type RecentActivityEntity = Prisma.FinancialRecordGetPayload<{
  select: typeof recentActivitySelect;
}>;

export type DashboardScope = {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  currencyCode?: string;
};

function buildDashboardWhere(scope: DashboardScope): Prisma.FinancialRecordWhereInput {
  const where: Prisma.FinancialRecordWhereInput = {
    deletedAt: null,
  };

  if (scope.userId) {
    where.userId = scope.userId;
  }

  if (scope.currencyCode) {
    where.currencyCode = scope.currencyCode;
  }

  if (scope.startDate || scope.endDate) {
    where.date = {
      gte: scope.startDate,
      lte: scope.endDate,
    };
  }

  return where;
}

export async function aggregateTotalsByType(scope: DashboardScope) {
  const where = buildDashboardWhere(scope);

  return prisma.financialRecord.groupBy({
    by: ["type", "currencyCode"],
    where,
    _sum: {
      amount: true,
    },
  });
}

export async function aggregateCategoryTotals(scope: DashboardScope) {
  const where = buildDashboardWhere(scope);

  return prisma.financialRecord.groupBy({
    by: ["category", "currencyCode"],
    where,
    _sum: {
      amount: true,
    },
  });
}

export async function listRecentActivity(
  scope: DashboardScope,
  pagination: {
    page: number;
    limit: number;
  },
) {
  const where = buildDashboardWhere(scope);
  const skip = (pagination.page - 1) * pagination.limit;

  const [items, total] = await prisma.$transaction([
    prisma.financialRecord.findMany({
      where,
      select: recentActivitySelect,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: pagination.limit,
    }),
    prisma.financialRecord.count({ where }),
  ]);

  return {
    items,
    total,
  };
}

export async function listTrendRecords(scope: DashboardScope) {
  const where = buildDashboardWhere(scope);

  return prisma.financialRecord.findMany({
    where,
    select: {
      date: true,
      type: true,
      amount: true,
      currencyCode: true,
    },
    orderBy: [{ date: "asc" }],
  });
}

export type TrendRecordEntity = {
  date: Date;
  type: RecordType;
  amount: Prisma.Decimal;
  currencyCode: string;
};
