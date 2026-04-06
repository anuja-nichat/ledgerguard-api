import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma, RecordType } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

jest.mock("@/data/dashboard.repo", () => ({
  aggregateCategoryTotals: jest.fn(),
  aggregateTotalsByType: jest.fn(),
  listRecentActivity: jest.fn(),
  listTrendRecords: jest.fn(),
}));

import { AppModule } from "@/nest/app.module";
import { ApiExceptionFilter } from "@/nest/common/api-exception.filter";
import { AuthContextGuard } from "@/nest/common/auth-context.guard";
import { ResponseEnvelopeInterceptor } from "@/nest/common/response-envelope.interceptor";
import { listTrendRecords } from "@/data/dashboard.repo";
import * as DashboardService from "@/services/dashboard.service";
import type { AuthContext } from "@/types/auth";

describe("api integration routes", () => {
  let app: INestApplication;

  const authContext: AuthContext = {
    userId: "cm1viewer0001",
    email: "viewer@finance.com",
    role: "VIEWER",
    status: "ACTIVE",
  };

  const dashboardSummarySpy = jest.spyOn(DashboardService, "getDashboardSummaryForContext");
  const mockedListTrendRecords = jest.mocked(listTrendRecords);

  const withAuthRole = async (role: AuthContext["role"], callback: () => Promise<void>) => {
    const previousRole = authContext.role;
    authContext.role = role;

    try {
      await callback();
    } finally {
      authContext.role = previousRole;
    }
  };

  beforeEach(() => {
    mockedListTrendRecords.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeAll(async () => {
    dashboardSummarySpy.mockResolvedValue({
      summary: {
        totalIncome: 2500,
        totalExpenses: 1000,
        netBalance: 1500,
      },
      categoryTotals: [
        {
          category: "Operations",
          amount: 1000,
        },
      ],
      currency: {
        code: "USD",
        symbol: "$",
      },
      period: {
        startDate: null,
        endDate: null,
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthContextGuard)
      .useValue({
        canActivate(context: { switchToHttp: () => { getRequest: () => { authContext?: AuthContext } } }) {
          const requestObject = context.switchToHttp().getRequest();
          requestObject.authContext = authContext;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    dashboardSummarySpy.mockRestore();
    await app.close();
  });

  it("returns enveloped health payload", async () => {
    const response = await request(app.getHttpServer()).get("/api/health").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe("ledgerguard-api");
    expect(response.body.data.status).toBe("healthy");
  });

  it("returns api root metadata", async () => {
    const response = await request(app.getHttpServer()).get("/api").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe("ledgerguard-api");
    expect(response.body.data.endpoints).toEqual({
      health: "/api/health",
      docs: "/api/docs",
      openapi: "/api/docs/openapi",
    });
  });

  it("returns OpenAPI JSON document", async () => {
    const response = await request(app.getHttpServer()).get("/api/docs/openapi").expect(200);

    expect(response.body.openapi).toBe("3.0.3");
    expect(typeof response.body.paths).toBe("object");
    expect(response.body.paths["/api/health"]).toBeDefined();
  });

  it("returns Swagger UI HTML", async () => {
    const response = await request(app.getHttpServer()).get("/api/docs").expect(200);

    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.text).toContain("SwaggerUIBundle");
  });

  it("returns authenticated user context from validate endpoint", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/auth/validate")
      .set("Authorization", "Bearer integration-test-token")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toEqual({
      id: authContext.userId,
      email: authContext.email,
      role: authContext.role,
      status: authContext.status,
    });
  });

  it("returns dashboard summary through mocked service", async () => {
    const response = await request(app.getHttpServer()).get("/api/dashboard/summary").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toEqual({
      totalIncome: 2500,
      totalExpenses: 1000,
      netBalance: 1500,
    });
    expect(dashboardSummarySpy).toHaveBeenCalled();
  });

  it("returns current-month trend metadata for an ongoing month selection", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-06T12:00:00.000Z"));

    mockedListTrendRecords.mockResolvedValue([
      {
        date: new Date("2026-01-15T00:00:00.000Z"),
        type: RecordType.INCOME,
        amount: new Prisma.Decimal(1000),
        currencyCode: "INR",
      },
      {
        date: new Date("2026-04-05T00:00:00.000Z"),
        type: RecordType.EXPENSE,
        amount: new Prisma.Decimal(200),
        currencyCode: "INR",
      },
      {
        date: new Date("2026-04-06T08:00:00.000Z"),
        type: RecordType.INCOME,
        amount: new Prisma.Decimal(50),
        currencyCode: "INR",
      },
    ]);

    await withAuthRole("ANALYST", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/dashboard/trends")
        .query({ selection: "apr" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.selectedOption).toBe("apr");
      expect(response.body.data.selectedMonth).toBe("2026-04");
      expect(response.body.data.trends[0].asOfDate).toBe("2026-04-06");
      expect(response.body.data.options).toBeUndefined();
      expect(response.body.data.period).toBeUndefined();

      const scope = mockedListTrendRecords.mock.calls[0]?.[0];
      expect(scope?.userId).toBe(authContext.userId);
      expect(scope?.endDate?.toISOString()).toBe("2026-04-06T12:00:00.000Z");
    });
  });

  it("returns completed-month trend metadata with month-end cutoff", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-06T12:00:00.000Z"));

    mockedListTrendRecords.mockResolvedValue([
      {
        date: new Date("2026-01-10T00:00:00.000Z"),
        type: RecordType.INCOME,
        amount: new Prisma.Decimal(500),
        currencyCode: "INR",
      },
      {
        date: new Date("2026-01-28T00:00:00.000Z"),
        type: RecordType.EXPENSE,
        amount: new Prisma.Decimal(100),
        currencyCode: "INR",
      },
      {
        date: new Date("2026-02-01T00:00:00.000Z"),
        type: RecordType.EXPENSE,
        amount: new Prisma.Decimal(75),
        currencyCode: "INR",
      },
    ]);

    await withAuthRole("ANALYST", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/dashboard/trends")
        .query({ selection: "jan" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.selectedOption).toBe("jan");
      expect(response.body.data.selectedMonth).toBe("2026-01");
      expect(response.body.data.trends[0].asOfDate).toBe("2026-01-31");
      expect(response.body.data.trends[0].bucket).toBe("2026-01");
      expect(response.body.data.options).toBeUndefined();
      expect(response.body.data.period).toBeUndefined();
    });
  });
});
