import { RecordType } from "@prisma/client";
import { describe, expect, it } from "@jest/globals";

import {
  computeCategoryTotalsInCurrency,
  computeSummaryFromTypeCurrencyTotals,
  computeSummaryFromTypeTotals,
  computeTrendSeries,
  computeTrendSeriesInCurrency,
  convertAmountBetweenDashboardCurrencies,
  dashboardSummaryQuerySchema,
  trendsQuerySchema,
} from "@/services/dashboard.service";

describe("dashboard summary math", () => {
  it("computes income, expense, and net correctly", () => {
    const summary = computeSummaryFromTypeTotals([
      { type: RecordType.INCOME, amount: 2000 },
      { type: RecordType.EXPENSE, amount: 600 },
      { type: RecordType.INCOME, amount: 400 },
    ]);

    expect(summary.totalIncome).toBe(2400);
    expect(summary.totalExpenses).toBe(600);
    expect(summary.netBalance).toBe(1800);
  });

  it("computes monthly trend buckets with net values", () => {
    const trend = computeTrendSeries(
      [
        { date: new Date("2026-01-10T00:00:00.000Z"), type: RecordType.INCOME, amount: 1000 },
        { date: new Date("2026-01-11T00:00:00.000Z"), type: RecordType.EXPENSE, amount: 250 },
        { date: new Date("2026-02-08T00:00:00.000Z"), type: RecordType.EXPENSE, amount: 100 },
      ],
      "month",
    );

    expect(trend).toEqual([
      { bucket: "2026-01", income: 1000, expense: 250, net: 750 },
      { bucket: "2026-02", income: 0, expense: 100, net: -100 },
    ]);
  });

  it("converts mixed-currency summary totals to INR", () => {
    const summary = computeSummaryFromTypeCurrencyTotals(
      [
        { type: RecordType.INCOME, currencyCode: "USD", amount: 100 },
        { type: RecordType.EXPENSE, currencyCode: "INR", amount: 1500 },
      ],
      "INR",
    );

    expect(summary).toEqual({
      totalIncome: 9274,
      totalExpenses: 1500,
      netBalance: 7774,
    });
  });

  it("converts mixed-currency category totals to USD", () => {
    const categoryTotals = computeCategoryTotalsInCurrency(
      [
        { category: "Operations", currencyCode: "INR", amount: 9274 },
        { category: "Operations", currencyCode: "USD", amount: 20 },
        { category: "Salary", currencyCode: "USD", amount: 10 },
      ],
      "USD",
    );

    expect(categoryTotals).toEqual([
      { category: "Operations", amount: 120 },
      { category: "Salary", amount: 10 },
    ]);
  });

  it("converts between INR and USD with consistent rates", () => {
    expect(convertAmountBetweenDashboardCurrencies(185.48, "INR", "USD")).toBeCloseTo(2, 8);
    expect(convertAmountBetweenDashboardCurrencies(2, "USD", "INR")).toBeCloseTo(185.48, 8);
  });

  it("converts mixed-currency trend buckets to USD", () => {
    const trend = computeTrendSeriesInCurrency(
      [
        {
          date: new Date("2026-03-10T00:00:00.000Z"),
          type: RecordType.INCOME,
          amount: 100,
          currencyCode: "USD",
        },
        {
          date: new Date("2026-03-12T00:00:00.000Z"),
          type: RecordType.EXPENSE,
          amount: 9274,
          currencyCode: "INR",
        },
        {
          date: new Date("2026-04-01T00:00:00.000Z"),
          type: RecordType.EXPENSE,
          amount: 10,
          currencyCode: "USD",
        },
      ],
      "month",
      "USD",
    );

    expect(trend).toEqual([
      { bucket: "2026-03", income: 100, expense: 100, net: 0 },
      { bucket: "2026-04", income: 0, expense: 10, net: -10 },
    ]);
  });

  it("accepts currencyCode filters for summary and trends queries", () => {
    const summaryQuery = dashboardSummaryQuerySchema.parse({
      currencyCode: "usd",
      targetCurrencyCode: "inr",
    });
    const trendQuery = trendsQuerySchema.parse({
      bucket: "month",
      currencyCode: "inr",
      targetCurrencyCode: "usd",
    });

    expect(summaryQuery.currencyCode).toBe("USD");
    expect(summaryQuery.targetCurrencyCode).toBe("INR");
    expect(trendQuery.currencyCode).toBe("INR");
    expect(trendQuery.targetCurrencyCode).toBe("USD");
  });
});

