import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { listAuditLogsForAdmin } from "../../services/audit-log.service";
import type { AuthContext } from "../../types/auth";
import { CurrentAuthContext } from "../common/auth-context.decorator";
import { AuthContextGuard } from "../common/auth-context.guard";

@Controller("audit-logs")
@UseGuards(AuthContextGuard)
export class AuditLogsController {
  @Get()
  async listAuditLogs(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await listAuditLogsForAdmin(context, query);

    return {
      success: true,
      data: {
        logs: result.logs,
      },
      meta: result.meta,
    };
  }
}