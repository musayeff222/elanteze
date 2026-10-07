import dotenv from "dotenv";
import path from "path";

dotenv.config();

function secret(name: string): string {
  const value = process.env[name];
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32)) {
    throw new Error(`${name} production mühitində ən azı 32 simvol olmalıdır`);
  }
  return value || `dev-only-${name}-not-for-production-use`;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://alver:alver@localhost:5432/alver?schema=public",
  jwtAccessSecret: secret("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: secret("JWT_REFRESH_SECRET"),
  accessTtlSec: 60 * 15,
  refreshTtlSec: 60 * 60 * 24 * 7,
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:8080")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || "uploads"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  isProd: process.env.NODE_ENV === "production",
  exposeDevTokens: process.env.NODE_ENV !== "production",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "ALVER <noreply@alver.az>",
  },
  maxImageBytes: 8 * 1024 * 1024,
  maxVideoBytes: 30 * 1024 * 1024,
  listingTtlDays: 30,
};

export const STAFF_ROLES = ["MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;
