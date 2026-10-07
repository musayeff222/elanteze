import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { errorHandler, notFound } from "./middleware/error";
import { openApiDocument } from "./openapi";
import { apiRouter } from "./routes";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/uploads", express.static(config.uploadDir, { index: false, dotfiles: "deny", fallthrough: false }));

  if (process.env.NODE_ENV !== "test") {
    app.use(
      "/api",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 400,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: "Çox sayda sorğu göndərdiniz. Bir az sonra yenidən cəhd edin." },
      }),
    );
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Çox sayda cəhd edildi. Bir az gözləyin." },
    });
    app.use("/api/auth/login", authLimiter);
    app.use("/api/auth/register", authLimiter);
    app.use("/api/auth/forgot-password", authLimiter);
  }

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: "ALVER API" }));
  app.get("/api/openapi.json", (_req, res) => res.json(openApiDocument));
  app.get("/sitemap.xml", async (_req, res, next) => {
    try {
      const { prisma } = await import("./lib/prisma");
      const listings = await prisma.listing.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
        take: 500,
        orderBy: { updatedAt: "desc" },
      });
      const urls = listings
        .map(
          (listing) =>
            `<url><loc>${config.frontendUrl}/elan/${listing.slug}</loc><lastmod>${listing.updatedAt.toISOString()}</lastmod></url>`,
        )
        .join("");
      res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
