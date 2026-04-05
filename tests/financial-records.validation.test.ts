import { describe, expect, it } from "@jest/globals";

import { ValidationError } from "@/lib/error";
import { parseWithSchema } from "@/lib/request";
import {
  createFinancialRecordSchema,
  listFinancialRecordsQuerySchema,
} from "@/services/financial-records.service";

describe("financial record validation", () => {
  it("accepts valid create payload", () => {
    const payload = parseWithSchema(
      createFinancialRecordSchema,
      {
        type: "income",
        amount: 1200,
        category: "Salary",
        date: "2026-03-01T00:00:00.000Z",
      },
      "Create financial record payload is invalid",
    );

    expect(payload.type).toBe("INCOME");
    expect(payload.amount).toBe(1200);
  });

  it("accepts currency code and symbol in create payload", () => {
    const payload = parseWithSchema(
      createFinancialRecordSchema,
      {
        type: "expense",
        amount: 999.5,
        currencyCode: "inr",
        currencySymbol: "â‚¹",
        category: "Travel",
        date: "2026-03-08T00:00:00.000Z",
      },
      "Create financial record payload is invalid",
    );

    expect(payload.currencyCode).toBe("INR");
    expect(payload.currencySymbol).toBe("â‚¹");
  });

  it("rejects create payload when only currencyCode is provided", () => {
    expect(() =>
      parseWithSchema(
        createFinancialRecordSchema,
        {
          type: "income",
          amount: 200,
          currencyCode: "USD",
          category: "Salary",
          date: "2026-03-01T00:00:00.000Z",
        },
        "Create financial record payload is invalid",
      ),
    ).toThrow(ValidationError);
  });

  it("rejects non-positive amount", () => {
    expect(() =>
      parseWithSchema(
        createFinancialRecordSchema,
        {
          type: "expense",
          amount: 0,
          category: "Ops",
          date: "2026-03-01T00:00:00.000Z",
        },
        "Create financial record payload is invalid",
      ),
    ).toThrow(ValidationError);
  });

  it("rejects invalid date range in list query", () => {
    expect(() =>
      parseWithSchema(
        listFinancialRecordsQuerySchema,
        {
          page: "1",
          limit: "10",
          startDate: "2026-03-31T00:00:00.000Z",
          endDate: "2026-03-01T00:00:00.000Z",
        },
        "Financial record query parameters are invalid",
      ),
    ).toThrow(ValidationError);
  });

  it("accepts INR/USD currencyCode in list query", () => {
    const query = parseWithSchema(
      listFinancialRecordsQuerySchema,
      {
        page: "1",
        limit: "10",
        currencyCode: "usd",
      },
      "Financial record query parameters are invalid",
    );

    expect(query.currencyCode).toBe("USD");
  });

  it("rejects unsupported currencyCode in list query", () => {
    expect(() =>
      parseWithSchema(
        listFinancialRecordsQuerySchema,
        {
          page: "1",
          limit: "10",
          currencyCode: "EUR",
        },
        "Financial record query parameters are invalid",
      ),
    ).toThrow(ValidationError);
  });
});

