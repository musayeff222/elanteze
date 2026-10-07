import { CookieOptions, Response } from "express";
import { config } from "../config";

const base = (): CookieOptions => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: "lax",
  path: "/",
});

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("alver_access", accessToken, {
    ...base(),
    maxAge: config.accessTtlSec * 1000,
  });
  res.cookie("alver_refresh", refreshToken, {
    ...base(),
    maxAge: config.refreshTtlSec * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("alver_access", base());
  res.clearCookie("alver_refresh", base());
}
