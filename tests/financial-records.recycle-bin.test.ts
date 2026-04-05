import { describe, expect, it } from "@jest/globals";

import { ValidationError } from "@/lib/error";
import { parseWithSchema } from "@/lib/request";
import {
  RECYCLE_BIN_RETENTION_DAYS,
  getRecycleBinCutoffDate,
  getRecycleBinDaysRemaining,
  getRecycleBinExpiresAt,
  isRecycleBinExpired,
  listDeletedFinancialRecordsQuerySchema,
} from "@/services/financial-records.service";

describe("financial record recycle bin", () => {
  it("uses a 30-day retention window", () => {
    expect(RECYCLE_BIN_RETENTION_DAYS).toBe(30);
  });

  it("computes recycle bin expiry from deleted timestamp", () => {
    const deletedAt = new Date("2026-03-01T00:00:00.000Z");

    expect(getRecycleBinExpiresAt(deletedAt).toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });

  it("marks records expired at or after the expiry timestamp", () => {
    const deletedAt = new Date("2026-03-01T00:00:00.000Z");

    expect(isRecycleBinExpired(deletedAt, new Date("2026-03-30T23:59:59.999Z"))).toBe(false);
    expect(isRecycleBinExpired(deletedAt, new Date("2026-03-31T00:00:00.000Z"))).toBe(true);
  });

  it("returns days remaining using ceiling semantics", () => {
    const deletedAt = new Date("2026-03-01T00:00:00.000Z");

    expect(getRecycleBinDaysRemaining(deletedAt, new Date("2026-03-30T12:00:00.000Z"))).toBe(1);
    expect(getRecycleBinDaysRemaining(deletedAt, new Date("2026-03-31T00:00:01.000Z"))).toBe(0);
  });

  it("computes purge cutoff date for expired records", () => {
    const now = new Date("2026-04-30T00:00:00.000Z");

    expect(getRecycleBinCutoffDate(now).toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });

  it("validates recycle-bin query input", () => {
    const query = parseWithSchema(
      listDeletedFinancialRecordsQuerySchema,
      {
        page: "1",
        limit: "10",
      },
      "Recycle bin query parameters are invalid",
    );

    expect(query.page).toBe(1);
    expect(query.limit).toBe(10);
  });

  it("rejects invalid recycle-bin query input", () => {
    expect(() =>
      parseWithSchema(
        listDeletedFinancialRecordsQuerySchema,
        {
          page: "0",
          limit: "500",
        },
        "Recycle bin query parameters are invalid",
      ),
    ).toThrow(ValidationError);
  });
});

