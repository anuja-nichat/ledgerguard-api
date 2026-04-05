import { Prisma, PrismaClient, type AuditAction, type AuditResource, type Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | PrismaClient;

const auditLogSelect = {
  id: true,
  action: true,
  resource: true,
  resourceId: true,
  actorUserId: true,
  actorEmail: true,
  actorRole: true,
  beforeSnapshot: true,
  afterSnapshot: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

export type AuditLogEntity = Prisma.AuditLogGetPayload<{
  select: typeof auditLogSelect;
}>;

export type ListAuditLogsInput = {
  page: number;
  limit: number;
  action?: AuditAction;
  resource?: AuditResource;
  actorUserId?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
};

export type CreateAuditLogInput = {
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: Role;
  beforeSnapshot?: Prisma.InputJsonValue;
  afterSnapshot?: Prisma.InputJsonValue;
};

export async function createAuditLog(input: CreateAuditLogInput, db: DbClient = prisma) {
  return db.auditLog.create({
    data: {
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      ...(input.beforeSnapshot !== undefined ? { beforeSnapshot: input.beforeSnapshot } : {}),
      ...(input.afterSnapshot !== undefined ? { afterSnapshot: input.afterSnapshot } : {}),
    },
  });
}

function buildAuditLogWhere(input: {
  action?: AuditAction;
  resource?: AuditResource;
  actorUserId?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
}): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (input.action) {
    where.action = input.action;
  }

  if (input.resource) {
    where.resource = input.resource;
  }

  if (input.actorUserId) {
    where.actorUserId = input.actorUserId;
  }

  if (input.resourceId) {
    where.resourceId = input.resourceId;
  }

  if (input.startDate || input.endDate) {
    where.createdAt = {
      gte: input.startDate,
      lte: input.endDate,
    };
  }

  return where;
}

export async function listAuditLogs(input: ListAuditLogsInput) {
  const where = buildAuditLogWhere(input);
  const skip = (input.page - 1) * input.limit;

  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      select: auditLogSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: input.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
  };
}
