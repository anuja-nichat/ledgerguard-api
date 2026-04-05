import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

import { AppModule } from "@/nest/app.module";
import { ApiExceptionFilter } from "@/nest/common/api-exception.filter";
import { AuthContextGuard } from "@/nest/common/auth-context.guard";
import { ResponseEnvelopeInterceptor } from "@/nest/common/response-envelope.interceptor";
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
});
