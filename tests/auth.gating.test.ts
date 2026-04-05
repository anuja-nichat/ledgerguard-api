import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { InactiveUserError } from "@/lib/error";

jest.mock("@/data/user.repo", () => ({
  findUserByEmailForAuth: jest.fn(),
  findUserById: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  issueAccessToken: jest.fn(() => "mocked-access-token"),
  extractBearerToken: jest.fn(() => "mocked-bearer-token"),
  verifyAccessToken: jest.fn(() => ({
    sub: "cm1activeuser0001",
    email: "viewer@finance.com",
    role: "VIEWER",
  })),
}));

import { findUserByEmailForAuth, findUserById } from "@/data/user.repo";
import { extractBearerToken, issueAccessToken, verifyAccessToken } from "@/lib/auth";
import { requireAuth } from "@/middleware/auth.middleware";
import { login } from "@/services/auth.service";

const mockedFindUserByEmailForAuth = jest.mocked(findUserByEmailForAuth);
const mockedFindUserById = jest.mocked(findUserById);
const mockedIssueAccessToken = jest.mocked(issueAccessToken);
const mockedExtractBearerToken = jest.mocked(extractBearerToken);
const mockedVerifyAccessToken = jest.mocked(verifyAccessToken);

describe("auth active and inactive gating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects login for inactive users", async () => {
    const inactivePasswordHash = await bcrypt.hash("inactive#78", 10);

    const inactiveAuthUser: NonNullable<Awaited<ReturnType<typeof findUserByEmailForAuth>>> = {
      id: "cm1inactiveuser0001",
      email: "inactive@finance.com",
      password: inactivePasswordHash,
      role: "VIEWER",
      status: "INACTIVE",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    };

    mockedFindUserByEmailForAuth.mockResolvedValue(inactiveAuthUser);

    await expect(
      login({
        email: "inactive@finance.com",
        password: "inactive#78",
      }),
    ).rejects.toBeInstanceOf(InactiveUserError);

    expect(mockedIssueAccessToken).not.toHaveBeenCalled();
  });

  it("returns auth context for active users", async () => {
    const activePublicUser: NonNullable<Awaited<ReturnType<typeof findUserById>>> = {
      id: "cm1activeuser0001",
      email: "viewer@finance.com",
      role: "VIEWER",
      status: "ACTIVE",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    };

    mockedFindUserById.mockResolvedValue(activePublicUser);

    const context = await requireAuth(
      new Request("http://localhost:3000/api/auth/validate", {
        headers: {
          Authorization: "Bearer mocked-bearer-token",
        },
      }),
    );

    expect(mockedExtractBearerToken).toHaveBeenCalled();
    expect(mockedVerifyAccessToken).toHaveBeenCalled();
    expect(context).toEqual({
      userId: "cm1activeuser0001",
      email: "viewer@finance.com",
      role: "VIEWER",
      status: "ACTIVE",
    });
  });

  it("rejects middleware auth context for inactive users", async () => {
    const inactivePublicUser: NonNullable<Awaited<ReturnType<typeof findUserById>>> = {
      id: "cm1inactiveuser0002",
      email: "inactive@finance.com",
      role: "ANALYST",
      status: "INACTIVE",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    };

    mockedFindUserById.mockResolvedValue(inactivePublicUser);

    await expect(
      requireAuth(
        new Request("http://localhost:3000/api/auth/validate", {
          headers: {
            Authorization: "Bearer mocked-bearer-token",
          },
        }),
      ),
    ).rejects.toBeInstanceOf(InactiveUserError);
  });
});

