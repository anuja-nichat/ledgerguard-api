import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";

import { AuditLogsController } from "./audit-logs/audit-logs.controller";
import { AuthController } from "./auth/auth.controller";
import { RateLimitMiddleware } from "./common/rate-limit.middleware";
import { DashboardController } from "./dashboard/dashboard.controller";
import { DocsController } from "./docs/docs.controller";
import { FinancialRecordsController } from "./financial-records/financial-records.controller";
import { ApiRootController } from "./health/api-root.controller";
import { HealthController } from "./health/health.controller";
import { UsersController } from "./users/users.controller";

@Module({
  controllers: [
    ApiRootController,
    HealthController,
    AuthController,
    UsersController,
    AuditLogsController,
    FinancialRecordsController,
    DashboardController,
    DocsController,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes({
      path: "*path",
      method: RequestMethod.ALL,
    });
  }
}