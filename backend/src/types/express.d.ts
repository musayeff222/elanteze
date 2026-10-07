import { Role } from "@prisma/client";

export type AuthUser = {
  id: string;
  role: Role;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isBlocked: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  deletedAt: Date | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
