import { Router } from "express";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { sanitizeText } from "../lib/text";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { reportSchema } from "../schemas";

export const reportRouter = Router();

reportRouter.post(
  "/",
  requireAuth,
  validate(reportSchema),
  asyncHandler(async (req, res) => {
    const { listingId, reason, details } = req.body as { listingId: string; reason: "FAKE"; details?: string };
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status === "DELETED") throw new HttpError(404, "Elan tapılmadı");
    if (listing.userId === req.user!.id) throw new HttpError(400, "Öz elanınızı şikayət edə bilməzsiniz");
    const existing = await prisma.report.findFirst({
      where: { listingId, reporterId: req.user!.id, status: { in: ["OPEN", "REVIEWING"] } },
    });
    if (existing) throw new HttpError(409, "Bu elan üçün açıq şikayətiniz var");
    const report = await prisma.report.create({
      data: {
        listingId,
        reporterId: req.user!.id,
        reason,
        details: details ? sanitizeText(details) : null,
      },
    });
    res.status(201).json({ message: "Şikayət qəbul edildi", report });
  }),
);
