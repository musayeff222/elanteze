import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors";
import { config } from "../config";

function zodMessage(issue: ZodError["issues"][number]): string {
  if (issue.message && issue.message !== "Required") return issue.message;
  return "Bu sahə mütləqdir";
}

export function notFound(req: Request, res: Response) {
  if (req.path.startsWith("/api") || req.originalUrl.startsWith("/api")) {
    res.status(404).json({ message: "Ünvan tapılmadı" });
    return;
  }
  res.status(404).json({ message: "Səhifə tapılmadı" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Məlumatlar düzgün deyil",
      errors: err.issues.map((issue) => ({
        field: issue.path.filter((part) => part !== "body" && part !== "query" && part !== "params").join("."),
        message: zodMessage(issue),
      })),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Fayl həcmi limitdən böyükdür" : "Fayl yüklənmədi";
    res.status(400).json({ message });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ message: "Bu məlumat artıq mövcuddur" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ message: "Qeyd tapılmadı" });
      return;
    }
  }

  if (err instanceof Error && err.message === "Telefon nömrəsi düzgün deyil") {
    res.status(400).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({
    message: "Daxili server xətası",
    ...(config.isProd ? {} : { detail: err instanceof Error ? err.message : "naməlum" }),
  });
}
