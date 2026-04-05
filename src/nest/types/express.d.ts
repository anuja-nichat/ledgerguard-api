import type { AuthContext } from "../../types/auth";

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export {};