import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import {
  createFinancialRecordForContext,
  deleteFinancialRecordForContext,
  getFinancialRecordByIdForContext,
  listDeletedFinancialRecordsForContext,
  listFinancialRecordsForContext,
  purgeExpiredDeletedFinancialRecordsForContext,
  restoreFinancialRecordForContext,
  updateFinancialRecordForContext,
} from "../../services/financial-records.service";
import type { AuthContext } from "../../types/auth";
import { CurrentAuthContext } from "../common/auth-context.decorator";
import { AuthContextGuard } from "../common/auth-context.guard";

@Controller("financial-records")
@UseGuards(AuthContextGuard)
export class FinancialRecordsController {
  @Get()
  async listFinancialRecords(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await listFinancialRecordsForContext(context, query);

    return {
      success: true,
      data: {
        records: result.records,
      },
      meta: result.meta,
    };
  }

  @Post()
  async createFinancialRecord(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: unknown,
  ) {
    const result = await createFinancialRecordForContext(context, body);

    return {
      record: result.record,
    };
  }

  @Get("recycle-bin")
  async listRecycleBinRecords(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    const result = await listDeletedFinancialRecordsForContext(context, query);

    return {
      success: true,
      data: {
        records: result.records,
      },
      meta: result.meta,
    };
  }

  @Delete("recycle-bin")
  @HttpCode(200)
  async purgeRecycleBinRecords(@CurrentAuthContext() context: AuthContext) {
    return purgeExpiredDeletedFinancialRecordsForContext(context);
  }

  @Post("recycle-bin/:id/restore")
  @HttpCode(200)
  async restoreFinancialRecord(
    @CurrentAuthContext() context: AuthContext,
    @Param("id") recordId: string,
  ) {
    const result = await restoreFinancialRecordForContext(context, recordId);

    return {
      record: result.record,
    };
  }

  @Get(":id")
  async getFinancialRecordById(
    @CurrentAuthContext() context: AuthContext,
    @Param("id") recordId: string,
  ) {
    const result = await getFinancialRecordByIdForContext(context, recordId);

    return {
      record: result.record,
    };
  }

  @Patch(":id")
  async updateFinancialRecord(
    @CurrentAuthContext() context: AuthContext,
    @Param("id") recordId: string,
    @Body() body: unknown,
  ) {
    const result = await updateFinancialRecordForContext(context, recordId, body);

    return {
      record: result.record,
    };
  }

  @Delete(":id")
  @HttpCode(204)
  async deleteFinancialRecord(
    @CurrentAuthContext() context: AuthContext,
    @Param("id") recordId: string,
  ) {
    await deleteFinancialRecordForContext(context, recordId);
  }
}