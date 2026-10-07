import { Router } from "express";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { sanitizeText } from "../lib/text";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { reviewSchema } from "../schemas";

export const reviewRouter = Router();

reviewRouter.post(
  "/",
  requireAuth,
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { listingId: string; revieweeId: string; rating: number; comment?: string };
    if (body.revieweeId === req.user!.id) throw new HttpError(400, "Özünüzə rəy yaza bilməzsiniz");
    const listing = await prisma.listing.findUnique({ where: { id: body.listingId } });
    if (!listing) throw new HttpError(404, "Elan tapılmadı");
    if (listing.userId !== body.revieweeId && body.revieweeId !== req.user!.id) {
      const involved = listing.userId === body.revieweeId;
      if (!involved) throw new HttpError(400, "Rəy yalnız bu elanın satıcısına yazıla bilər");
    }
    if (listing.userId !== body.revieweeId) throw new HttpError(400, "Rəy yalnız satıcıya yazıla bilər");
    const conversation = await prisma.conversation.findFirst({
      where: {
        listingId: listing.id,
        OR: [
          { buyerId: req.user!.id, sellerId: body.revieweeId },
          { sellerId: req.user!.id, buyerId: body.revieweeId },
        ],
      },
    });
    if (!conversation) throw new HttpError(403, "Rəy yazmaq üçün satıcı ilə yazışma olmalıdır");
    const review = await prisma.review.create({
      data: {
        reviewerId: req.user!.id,
        revieweeId: body.revieweeId,
        listingId: listing.id,
        rating: body.rating,
        comment: body.comment ? sanitizeText(body.comment) : null,
      },
      include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
    res.status(201).json({ message: "Rəy əlavə edildi", review });
  }),
);

reviewRouter.get(
  "/user/:userId",
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { revieweeId: req.params.userId },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        listing: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const agg = await prisma.review.aggregate({
      where: { revieweeId: req.params.userId },
      _avg: { rating: true },
      _count: true,
    });
    res.json({
      items: reviews,
      rating: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
      count: agg._count,
    });
  }),
);
