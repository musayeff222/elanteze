import { Router } from "express";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { favoriteInclude } from "../services/listings";
import { ListingRecord, serializeListing } from "../services/serialize";

export const favoriteRouter = Router();
favoriteRouter.use(requireAuth);

favoriteRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await prisma.favorite.findMany({
      where: { userId: req.user!.id, listing: { status: { in: ["ACTIVE", "SOLD"] } } },
      include: { listing: { include: favoriteInclude(req.user!.id) } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items: rows.map((row) => serializeListing(row.listing as ListingRecord)) });
  }),
);

favoriteRouter.post(
  "/:listingId",
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.listingId } });
    if (!listing || listing.status !== "ACTIVE") throw new HttpError(404, "Elan tapılmadı");
    await prisma.favorite.upsert({
      where: { userId_listingId: { userId: req.user!.id, listingId: listing.id } },
      update: {},
      create: { userId: req.user!.id, listingId: listing.id },
    });
    res.status(201).json({ message: "Favoriyə əlavə edildi" });
  }),
);

favoriteRouter.delete(
  "/:listingId",
  asyncHandler(async (req, res) => {
    await prisma.favorite.deleteMany({ where: { userId: req.user!.id, listingId: req.params.listingId } });
    res.json({ message: "Favoridən silindi" });
  }),
);
