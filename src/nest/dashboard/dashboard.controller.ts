import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import {
  getDashboardSummaryForContext,
  getRecentActivityForContext,
  getTrendsForContext,
} from "../../services/dashboard.service";
import type { AuthContext } from "../../types/auth";
import { CurrentAuthContext } from "../common/auth-context.decorator";
import { AuthContextGuard } from "../common/auth-context.guard";

@Controller("dashboard")
@UseGuards(AuthContextGuard)
export class DashboardController {
  @Get("summary")
  async getDashboardSummary(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    return getDashboardSummaryForContext(context, query);
  }

  @Get("recent-activity")
  async getRecentActivity(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await getRecentActivityForContext(context, query);

    return {
      success: true,
      data: {
        activities: result.activities,
      },
      meta: result.meta,
    };
  }

  @Get("trends")
  async getTrends(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    return getTrendsForContext(context, query);
  }
}