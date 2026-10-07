import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { verifyAccessToken } from "../lib/tokens";

async function loadUser(req: Request) {
  const token = req.cookies?.alver_access as string | undefined;
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isBlocked: true,
        emailVerified: true,
        phoneVerified: true,
        deletedAt: true,
      },
    });
    if (!user || user.isBlocked || user.deletedAt) return null;
    return user;
  } catch {
    return null;
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    req.user = (await loadUser(req)) ?? undefined;
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await loadUser(req);
    if (!user) {
      next(new HttpError(401, "Daxil olmaq lazımdır"));
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new HttpError(401, "Daxil olmaq lazımdır"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, "Bu əməliyyat üçün icazəniz yoxdur"));
      return;
    }
    next();
  };
}

export function requireVerified(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.emailVerified && !req.user?.phoneVerified) {
    next(new HttpError(403, "Elan yerləşdirmək üçün e-poçt və ya telefon təsdiqi lazımdır"));
    return;
  }
  next();
}
