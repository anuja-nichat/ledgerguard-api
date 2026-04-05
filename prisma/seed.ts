import { PrismaClient, RecordType, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type EnsureRecordInput = {
  userId: string;
  type: RecordType;
  amount: number;
  currencyCode: string;
  currencySymbol: string;
  category: string;
  date: Date;
  notes: string;
};

async function ensureActiveRecordForUser(input: EnsureRecordInput): Promise<boolean> {
  const activeRecordCount = await prisma.financialRecord.count({
    where: {
      userId: input.userId,
      deletedAt: null,
    },
  });

  if (activeRecordCount > 0) {
    return false;
  }

  await prisma.financialRecord.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      currencyCode: input.currencyCode,
      currencySymbol: input.currencySymbol,
      category: input.category,
      date: input.date,
      notes: input.notes,
    },
  });

  return true;
}

async function main() {
  const hashedPassword1 = await bcrypt.hash("Admin#12", 10);
  const hashedPassword2 = await bcrypt.hash("Analyst#34", 10);
  const hashedPassword3 = await bcrypt.hash("Viewer#56", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@finance.com" },
    update: {
      password: hashedPassword1,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "admin@finance.com",
      password: hashedPassword1,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: "analyst@finance.com" },
    update: {
      password: hashedPassword2,
      role: Role.ANALYST,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "analyst@finance.com",
      password: hashedPassword2,
      role: Role.ANALYST,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { email: "viewer@finance.com" },
    update: {
      password: hashedPassword3,
      role: Role.VIEWER,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: "viewer@finance.com",
      password: hashedPassword3,
      role: Role.VIEWER,
      status: UserStatus.ACTIVE,
    },
  });

  const adminRecordCreated = await ensureActiveRecordForUser({
    userId: admin.id,
    type: RecordType.INCOME,
    amount: 5000,
    currencyCode: "USD",
    currencySymbol: "$",
    category: "Salary",
    date: new Date("2026-03-01T00:00:00.000Z"),
    notes: "Monthly payroll",
  });

  const analystRecordCreated = await ensureActiveRecordForUser({
    userId: analyst.id,
    type: RecordType.EXPENSE,
    amount: 1200,
    currencyCode: "INR",
    currencySymbol: "₹",
    category: "Operations",
    date: new Date("2026-03-05T00:00:00.000Z"),
    notes: "Vendor invoice",
  });

  console.log(
    `Seed completed with admin, analyst, and viewer users. Created records -> admin: ${adminRecordCreated}, analyst: ${analystRecordCreated}`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
