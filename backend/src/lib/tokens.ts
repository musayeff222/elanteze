import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { randomToken } from "./password";

export type AccessPayload = {
  sub: string;
  role: Role;
};

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTtlSec });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: "refresh", jti: randomToken(16) }, config.jwtRefreshSecret, {
    expiresIn: config.refreshTtlSec,
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const payload = jwt.verify(token, config.jwtAccessSecret) as AccessPayload;
  if (!payload.sub) throw new Error("Token etibarsızdır");
  return payload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  const payload = jwt.verify(token, config.jwtRefreshSecret) as { sub?: string; typ?: string };
  if (!payload.sub || payload.typ !== "refresh") throw new Error("Yeniləmə tokeni etibarsızdır");
  return { sub: payload.sub };
}
