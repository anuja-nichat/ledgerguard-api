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

const MONTH_SELECTION_VALUES = [
  "overall",
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

const trendSelectionSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(MONTH_SELECTION_VALUES),
);

type MonthSelection = Exclude<z.infer<typeof trendSelectionSchema>, "overall">;

const MONTH_SELECTION_TO_NUMBER: Record<MonthSelection, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const TREND_DROPDOWN_OPTIONS = [
  { value: "overall", label: "Overall" },
  { value: "jan", label: "Jan" },
  { value: "feb", label: "Feb" },
  { value: "mar", label: "Mar" },
  { value: "apr", label: "Apr" },
  { value: "may", label: "May" },
  { value: "jun", label: "Jun" },
  { value: "jul", label: "Jul" },
  { value: "aug", label: "Aug" },
  { value: "sep", label: "Sep" },
  { value: "oct", label: "Oct" },
  { value: "nov", label: "Nov" },
  { value: "dec", label: "Dec" },
] as const;

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
    selection: trendSelectionSchema.optional(),
    userId: z.string().cuid().optional(),
    currencyCode: dashboardCurrencyCodeSchema.optional(),
    targetCurrencyCode: dashboardCurrencyCodeSchema.optional().default("INR"),
  })
  .strict();

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

export function computeTrendSeries(records: TrendPointInput[]) {
  const aggregates = new Map<
    string,
    {
      income: number;
      expense: number;
    }
  >();

  for (const record of records) {
    const bucketKey = toMonthBucket(record.date);

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

  return computeTrendSeries(convertedRecords).map((point) => ({
    ...point,
    income: roundCurrencyAmount(point.income),
    expense: roundCurrencyAmount(point.expense),
    net: roundCurrencyAmount(point.net),
  }));
}

type TrendPoint = {
  bucket: string;
  income: number;
  expense: number;
  net: number;
  asOfDate: string;
};

function getCurrentUtcMonthKey(now: Date): string {
  return toMonthBucket(now);
}

export function getMonthKeyFromSelectionAtOrBeforeNow(monthSelection: MonthSelection, now: Date): string {
  const monthNumber = MONTH_SELECTION_TO_NUMBER[monthSelection];
  const currentYear = now.getUTCFullYear();
  const currentMonthNumber = now.getUTCMonth() + 1;
  const resolvedYear = monthNumber > currentMonthNumber ? currentYear - 1 : currentYear;

  return `${resolvedYear}-${`${monthNumber}`.padStart(2, "0")}`;
}

function getUtcMonthStart(monthKey: string): Date {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function getUtcMonthEnd(monthKey: string): Date {
  const start = getUtcMonthStart(monthKey);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function computeSingleTrendPoint(
  records: TrendCurrencyPointInput[],
  bucket: string,
  cutoffDate: Date,
  targetCurrencyCode: DashboardCurrencyCode,
): TrendPoint {
  const summary = computeSummaryFromTypeTotals(
    records.map((record) => ({
      type: record.type,
      amount: convertAmountBetweenDashboardCurrencies(
        record.amount,
        record.currencyCode,
        targetCurrencyCode,
      ),
    })),
  );

  return {
    bucket,
    income: roundCurrencyAmount(summary.totalIncome),
    expense: roundCurrencyAmount(summary.totalExpenses),
    net: roundCurrencyAmount(summary.netBalance),
    asOfDate: cutoffDate.toISOString().slice(0, 10),
  };
}

function buildTrendDropdownOptions() {
  return TREND_DROPDOWN_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));
}

function resolveTrendSelection(
  query: z.infer<typeof trendsQuerySchema>,
  now: Date,
): {
  view: "overall" | "month";
  selectedOption: z.infer<typeof trendSelectionSchema>;
  selectedMonth: string | null;
} {
  if (query.selection) {
    if (query.selection === "overall") {
      return {
        view: "overall",
        selectedOption: "overall",
        selectedMonth: null,
      };
    }

    return {
      view: "month",
      selectedOption: query.selection,
      selectedMonth: getMonthKeyFromSelectionAtOrBeforeNow(query.selection, now),
    };
  }

  return {
    view: "overall",
    selectedOption: "overall",
    selectedMonth: null,
  };
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
  const now = new Date();

  const allRecords = await listTrendRecords({
    userId: scopedUserId,
    endDate: now,
    currencyCode: query.currencyCode,
  });

  const normalizedRecords = allRecords.map((record) => ({
    date: record.date,
    type: record.type,
    amount: decimalToNumber(record.amount),
    currencyCode: toDashboardCurrencyCode(record.currencyCode),
  }));

  const trendSelection = resolveTrendSelection(query, now);

  if (trendSelection.view === "overall") {
    const trendPoint = computeSingleTrendPoint(normalizedRecords, "overall", now, query.targetCurrencyCode);

    return {
      bucket: "month",
      view: "overall",
      selectedMonth: null,
      selectedOption: "overall",
      trends: [trendPoint],
      options: buildTrendDropdownOptions(),
      currency: {
        code: query.targetCurrencyCode,
        symbol: DASHBOARD_CURRENCY_SYMBOLS[query.targetCurrencyCode],
      },
      period: {
        startDate: allRecords[0]?.date.toISOString() ?? null,
        endDate: now.toISOString(),
      },
    };
  }

  const selectedMonth = trendSelection.selectedMonth ?? getCurrentUtcMonthKey(now);

  const monthStart = getUtcMonthStart(selectedMonth);
  const monthEnd = getUtcMonthEnd(selectedMonth);
  const cutoffDate = selectedMonth === getCurrentUtcMonthKey(now) ? now : monthEnd;
  const monthRecords = normalizedRecords.filter(
    (record) => record.date >= monthStart && record.date <= cutoffDate,
  );

  const trendPoint = computeSingleTrendPoint(
    monthRecords,
    selectedMonth,
    cutoffDate,
    query.targetCurrencyCode,
  );

  return {
    bucket: "month",
    view: "month",
    selectedMonth,
    selectedOption: trendSelection.selectedOption,
    trends: [trendPoint],
    currency: {
      code: query.targetCurrencyCode,
      symbol: DASHBOARD_CURRENCY_SYMBOLS[query.targetCurrencyCode],
    },
  };
}
