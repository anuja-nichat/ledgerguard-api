import { Role } from "@prisma/client";
import { describe, expect, it } from "@jest/globals";

import { ForbiddenError } from "@/lib/error";
import {
  assertHasRole,
  canManageUsers,
  canReadDashboard,
  canReadInsights,
  canReadRecords,
  canWriteFinancialRecords,
} from "@/lib/rbac";

describe("rbac", () => {
  it("allows viewer/analyst/admin to read records", () => {
    expect(canReadRecords(Role.VIEWER)).toBe(true);
    expect(canReadRecords(Role.ANALYST)).toBe(true);
    expect(canReadRecords(Role.ADMIN)).toBe(true);
  });

  it("only allows analyst/admin to read insights", () => {
    expect(canReadInsights(Role.VIEWER)).toBe(false);
    expect(canReadInsights(Role.ANALYST)).toBe(true);
    expect(canReadInsights(Role.ADMIN)).toBe(true);
  });

  it("only allows admin to manage users and write records", () => {
    expect(canManageUsers(Role.VIEWER)).toBe(false);
    expect(canManageUsers(Role.ANALYST)).toBe(false);
    expect(canManageUsers(Role.ADMIN)).toBe(true);

    expect(canWriteFinancialRecords(Role.VIEWER)).toBe(false);
    expect(canWriteFinancialRecords(Role.ANALYST)).toBe(false);
    expect(canWriteFinancialRecords(Role.ADMIN)).toBe(true);
  });

  it("allows all authenticated roles to read dashboard", () => {
    expect(canReadDashboard(Role.VIEWER)).toBe(true);
    expect(canReadDashboard(Role.ANALYST)).toBe(true);
    expect(canReadDashboard(Role.ADMIN)).toBe(true);
  });

  it("throws ForbiddenError when role is not allowed", () => {
    expect(() => assertHasRole(Role.VIEWER, [Role.ADMIN])).toThrow(ForbiddenError);
  });
});

