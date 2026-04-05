import { RecordType, Role } from "@prisma/client";
import { z } from "zod";

import {
  aggregateCategoryTotals,
  aggregateTotalsByType,
  listRecentActivity,
  listTrendRecords,
  type TrendRecordEntity,
} from "@/data/dashboard.repo";
import { BusinessRuleError, ForbiddenError } from "@/lib/error";
import { parseWithSchema } from "@/lib/request";
import { canReadDashboard, canReadInsights } from "@/lib/rbac";
import type { AuthContext } from "@/types/auth";

const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Must be a valid date string",
});

const bucketSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() : value),
  z.enum(["week", "month"]),
);

const dashboardCurrencyCodeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.enum(["INR", "USD"]),
);

const DASHBOARD_CURRENCY_TO_INR_RATE = {
  INR: 1,
  USD: 92.74,
} as const;

const DASHBOARD_CURRENCY_SYMBOLS = {
  INR: "₹",
  USD: "$",
} as const;

export type DashboardCurrencyCode = z.infer<typeof dashboardCurrencyCodeSchema>;

export const dashboardSummaryQuerySchema = z
  .object({
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    userId: z.string().cuid().optional(),
    currencyCode: dashboardCurrencyCodeSchema.optional(),
    targetCurrencyCode: dashboardCurrencyCodeSchema.optional().default("INR"),
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

export const recentActivityQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
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

export const trendsQuerySchema = z
  .object({
    bucket: bucketSchema.default("month"),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    userId: z.string().cuid().optional(),
    currencyCode: dashboardCurrencyCodeSchema.optional(),
    targetCurrencyCode: dashboardCurrencyCodeSchema.optional().default("INR"),
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

export type TrendBucket = z.infer<typeof bucketSchema>;

type SummaryTypeTotalInput = {
  type: RecordType;
  amount: number;
};

type SummaryTypeCurrencyTotalInput = {
  type: RecordType;
  currencyCode: DashboardCurrencyCode;
  amount: number;
};

type CategoryCurrencyTotalInput = {
  category: string;
  currencyCode: DashboardCurrencyCode;
  amount: number;
};

type TrendPointInput = {
  date: Date;
  type: RecordType;
  amount: number;
};

type TrendCurrencyPointInput = TrendPointInput & {
  currencyCode: DashboardCurrencyCode;
};

export function computeSummaryFromTypeTotals(items: SummaryTypeTotalInput[]) {
  const income = items
    .filter((item) => item.type === RecordType.INCOME)
    .reduce((sum, item) => sum + item.amount, 0);

  const expenses = items
    .filter((item) => item.type === RecordType.EXPENSE)
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    totalIncome: income,
    totalExpenses: expenses,
    netBalance: income - expenses,
  };
}

function roundCurrencyAmount(amount: number): number {
  return Number(amount.toFixed(2));
}

function toDashboardCurrencyCode(currencyCode: string): DashboardCurrencyCode {
  if (currencyCode === "INR" || currencyCode === "USD") {
    return currencyCode;
  }

  throw new BusinessRuleError(`Dashboard data contains unsupported currencyCode: ${currencyCode}`);
}

export function convertAmountBetweenDashboardCurrencies(
  amount: number,
  fromCurrencyCode: DashboardCurrencyCode,
  toCurrencyCode: DashboardCurrencyCode,
): number {
  const amountInInr = amount * DASHBOARD_CURRENCY_TO_INR_RATE[fromCurrencyCode];
  return amountInInr / DASHBOARD_CURRENCY_TO_INR_RATE[toCurrencyCode];
}

export function computeSummaryFromTypeCurrencyTotals(
  items: SummaryTypeCurrencyTotalInput[],
  targetCurrencyCode: DashboardCurrencyCode,
) {
  const summary = computeSummaryFromTypeTotals(
    items.map((item) => ({
      type: item.type,
      amount: convertAmountBetweenDashboardCurrencies(
        item.amount,
        item.currencyCode,
        targetCurrencyCode,
      ),
    })),
  );

  return {
    totalIncome: roundCurrencyAmount(summary.totalIncome),
    totalExpenses: roundCurrencyAmount(summary.totalExpenses),
    netBalance: roundCurrencyAmount(summary.netBalance),
  };
}

export function computeCategoryTotalsInCurrency(
  items: CategoryCurrencyTotalInput[],
  targetCurrencyCode: DashboardCurrencyCode,
) {
  const categoryTotals = new Map<string, number>();

  for (const item of items) {
    const convertedAmount = convertAmountBetweenDashboardCurrencies(
      item.amount,
      item.currencyCode,
      targetCurrencyCode,
    );
    const currentAmount = categoryTotals.get(item.category) ?? 0;

    categoryTotals.set(item.category, currentAmount + convertedAmount);
  }

  return [...categoryTotals.entries()]
    .map(([category, amount]) => ({
      category,
      amount: roundCurrencyAmount(amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function toMonthBucket(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");

  return `${year}-${month}`;
}

function toWeekBucket(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = utcDate.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  utcDate.setUTCDate(utcDate.getUTCDate() + mondayOffset);
  return utcDate.toISOString().slice(0, 10);
}

export function computeTrendSeries(records: TrendPointInput[], bucket: TrendBucket) {
  const aggregates = new Map<
    string,
    {
      income: number;
      expense: number;
    }
  >();

  for (const record of records) {
    const bucketKey = bucket === "month" ? toMonthBucket(record.date) : toWeekBucket(record.date);

    const current = aggregates.get(bucketKey) ?? { income: 0, expense: 0 };
    if (record.type === RecordType.INCOME) {
      current.income += record.amount;
    } else {
      current.expense += record.amount;
    }

    aggregates.set(bucketKey, current);
  }

  return [...aggregates.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucketKey, value]) => ({
      bucket: bucketKey,
      income: value.income,
      expense: value.expense,
      net: value.income - value.expense,
    }));
}

export function computeTrendSeriesInCurrency(
  records: TrendCurrencyPointInput[],
  bucket: TrendBucket,
  targetCurrencyCode: DashboardCurrencyCode,
) {
  const convertedRecords = records.map((record) => ({
    date: record.date,
    type: record.type,
    amount: convertAmountBetweenDashboardCurrencies(
      record.amount,
      record.currencyCode,
      targetCurrencyCode,
    ),
  }));

  return computeTrendSeries(convertedRecords, bucket).map((point) => ({
    ...point,
    income: roundCurrencyAmount(point.income),
    expense: roundCurrencyAmount(point.expense),
    net: roundCurrencyAmount(point.net),
  }));
}

function resolveScopedUserId(context: AuthContext, requestedUserId?: string) {
  if (context.role === Role.ADMIN) {
    return requestedUserId;
  }

  if (requestedUserId && requestedUserId !== context.userId) {
    throw new ForbiddenError("Non-admin users can only read their own dashboard data");
  }

  return context.userId;
}

function parseDateRange(input: { startDate?: string; endDate?: string }) {
  return {
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
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

function decimalToNumber(decimal: TrendRecordEntity["amount"]): number {
  return Number(decimal.toString());
}

export async function getDashboardSummaryForContext(context: AuthContext, rawQuery: unknown) {
  if (!canReadDashboard(context.role)) {
    throw new ForbiddenError("Current role cannot read dashboard summary");
  }

  const query = parseWithSchema(
    dashboardSummaryQuerySchema,
    rawQuery,
    "Dashboard summary query parameters are invalid",
  );
  const scopedUserId = resolveScopedUserId(context, query.userId);
  const dateRange = parseDateRange(query);

  const [totalsByType, categoryTotals] = await Promise.all([
    aggregateTotalsByType({
      userId: scopedUserId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      currencyCode: query.currencyCode,
    }),
    aggregateCategoryTotals({
      userId: scopedUserId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      currencyCode: query.currencyCode,
    }),
  ]);

  const summary = computeSummaryFromTypeCurrencyTotals(
    totalsByType.map((item) => ({
      type: item.type,
      currencyCode: toDashboardCurrencyCode(item.currencyCode),
      amount: Number(item._sum.amount?.toString() ?? 0),
    })),
    query.targetCurrencyCode,
  );

  const categories = computeCategoryTotalsInCurrency(
    categoryTotals.map((item) => ({
      category: item.category,
      currencyCode: toDashboardCurrencyCode(item.currencyCode),
      amount: Number(item._sum.amount?.toString() ?? 0),
    })),
    query.targetCurrencyCode,
  );

  return {
    summary,
    categoryTotals: categories,
    currency: {
      code: query.targetCurrencyCode,
      symbol: DASHBOARD_CURRENCY_SYMBOLS[query.targetCurrencyCode],
    },
    period: {
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
    },
  };
}

export async function getRecentActivityForContext(context: AuthContext, rawQuery: unknown) {
  if (!canReadDashboard(context.role)) {
    throw new ForbiddenError("Current role cannot read dashboard recent activity");
  }

  const query = parseWithSchema(
    recentActivityQuerySchema,
    rawQuery,
    "Dashboard recent activity query parameters are invalid",
  );

  const scopedUserId = resolveScopedUserId(context, query.userId);
  const dateRange = parseDateRange(query);
  const result = await listRecentActivity(
    {
      userId: scopedUserId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    },
    {
      page: query.page,
      limit: query.limit,
    },
  );

  return {
    activities: result.items.map((item) => {
      const amount = Number(item.amount.toString());

      return {
        ...item,
        amount,
        amountDisplay: `${item.currencySymbol}${amount.toFixed(2)}`,
      };
    }),
    meta: buildPaginationMeta(query.page, query.limit, result.total),
  };
}

export async function getTrendsForContext(context: AuthContext, rawQuery: unknown) {
  if (!canReadInsights(context.role)) {
    throw new ForbiddenError("Current role cannot read dashboard trend insights");
  }

  const query = parseWithSchema(trendsQuerySchema, rawQuery, "Dashboard trend query parameters are invalid");
  const scopedUserId = resolveScopedUserId(context, query.userId);
  const dateRange = parseDateRange(query);

  const records = await listTrendRecords({
    userId: scopedUserId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    currencyCode: query.currencyCode,
  });

  const trendSeries = computeTrendSeriesInCurrency(
    records.map((record) => ({
      date: record.date,
      type: record.type,
      amount: decimalToNumber(record.amount),
      currencyCode: toDashboardCurrencyCode(record.currencyCode),
    })),
    query.bucket,
    query.targetCurrencyCode,
  );

  return {
    bucket: query.bucket,
    trends: trendSeries,
    currency: {
      code: query.targetCurrencyCode,
      symbol: DASHBOARD_CURRENCY_SYMBOLS[query.targetCurrencyCode],
    },
    period: {
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
    },
  };
}
