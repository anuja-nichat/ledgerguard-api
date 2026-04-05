import { AuditAction, AuditResource, Role } from "@prisma/client";
import { z } from "zod";

import { listAuditLogs } from "@/data/audit-log.repo";
import { ForbiddenError } from "@/lib/error";
import { parseWithSchema } from "@/lib/request";
import type { AuthContext } from "@/types/auth";

const auditActionSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toUpperCase() : value),
  z.nativeEnum(AuditAction),
);

const auditResourceSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.toUpperCase() : value),
  z.nativeEnum(AuditResource),
);

const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Must be a valid date string",
});

export const listAuditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    action: auditActionSchema.optional(),
    resource: auditResourceSchema.optional(),
    actorUserId: z.string().trim().min(1).max(100).optional(),
    resourceId: z.string().trim().min(1).max(100).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
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

function assertAdmin(context: AuthContext) {
  if (context.role !== Role.ADMIN) {
    throw new ForbiddenError("Only admin users can view audit logs");
  }
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

export async function listAuditLogsForAdmin(context: AuthContext, rawQuery: unknown) {
  assertAdmin(context);

  const query = parseWithSchema(
    listAuditLogsQuerySchema,
    rawQuery,
    "Audit log query parameters are invalid",
  );

  const result = await listAuditLogs({
    page: query.page,
    limit: query.limit,
    action: query.action,
    resource: query.resource,
    actorUserId: query.actorUserId,
    resourceId: query.resourceId,
    startDate: query.startDate ? new Date(query.startDate) : undefined,
    endDate: query.endDate ? new Date(query.endDate) : undefined,
  });

  return {
    logs: result.items,
    meta: {
      ...buildPaginationMeta(query.page, query.limit, result.total),
      filters: {
        action: query.action ?? null,
        resource: query.resource ?? null,
        actorUserId: query.actorUserId ?? null,
        resourceId: query.resourceId ?? null,
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
      },
    },
  };
}
