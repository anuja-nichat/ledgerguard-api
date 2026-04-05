import { Prisma, PrismaClient, type Role, type UserStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | PrismaClient;

const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export type ListUsersInput = {
  page: number;
  limit: number;
  role?: Role;
  status?: UserStatus;
};

export async function findUserByEmailForAuth(email: string, db: DbClient = prisma) {
  return db.user.findUnique({
    where: { email },
  });
}

export async function findUserById(id: string, db: DbClient = prisma) {
  return db.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
}

export async function listUsers(input: ListUsersInput) {
  const where: Prisma.UserWhereInput = {
    role: input.role,
    status: input.status,
  };

  const skip = (input.page - 1) * input.limit;

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: input.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total };
}

export async function createUser(input: {
  email: string;
  password: string;
  role: Role;
  status: UserStatus;
}, db: DbClient = prisma) {
  return db.user.create({
    data: input,
    select: publicUserSelect,
  });
}

export async function updateUser(
  id: string,
  data: {
    email?: string;
    password?: string;
    role?: Role;
    status?: UserStatus;
  },
  db: DbClient = prisma,
) {
  return db.user.update({
    where: { id },
    data,
    select: publicUserSelect,
  });
}

export async function assignUserRole(id: string, role: Role, db: DbClient = prisma) {
  return db.user.update({
    where: { id },
    data: { role },
    select: publicUserSelect,
  });
}

export async function deleteUser(id: string, db: DbClient = prisma) {
  return db.user.delete({
    where: { id },
    select: { id: true },
  });
}
