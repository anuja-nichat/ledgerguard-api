import type { Role, UserStatus } from "@prisma/client";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export type AuthContext = {
  userId: string;
  email: string;
  role: Role;
  status: UserStatus;
};
