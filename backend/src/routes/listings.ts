import { ItemCondition } from "@prisma/client";
import { Router } from "express";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { normalizePhone } from "../lib/text";
import { asyncHandler } from "../middleware/asyncHandler";
import { optionalAuth, requireAuth, requireVerified } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createListingSchema, idParamSchema, listingQuerySchema, updateListingSchema } from "../schemas";
import { createListing, getListingBySlugOrId, queryListings, similarListings, updateListing } from "../services/listings";

export const listingRouter = Router();

listingRouter.get(
  "/",
  optionalAuth,
  validate(listingQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const result = await queryListings({
      q: query.q,
      category: query.category,
      subcategory: query.subcategory,
      city: query.city,
      district: query.district,
      condition: query.condition as ItemCondition | undefined,
      brand: query.brand,
      minPrice: query.minPrice ? Number(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
      date: query.date,
      sort: query.sort,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
      featured: query.featured === "true",
      sellerId: query.sellerId,
      userId: req.user?.id,
    });
    res.json(result);
  }),
);

listingRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await prisma.listing.findMany({
      where: {
        userId: req.user!.id,
        status: status ? (status as never) : { not: "DELETED" },
      },
      include: {
        images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
        city: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true, icon: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      items: rows.map((row) => ({
        ...row,
        price: Number(row.price),
      })),
    });
  }),
);

listingRouter.post(
  "/",
  requireAuth,
  requireVerified,
  validate(createListingSchema),
  asyncHandler(async (req, res) => {
    let phone: string;
    try {
      phone = normalizePhone(req.body.phone);
    } catch {
      throw new HttpError(400, "Telefon nömrəsi düzgün deyil");
    }
    const listing = await createListing(req.user!.id, { ...req.body, phone });
    res.status(201).json({
      message: listing.status === "ACTIVE" ? "Elan yayımlandı" : "Elan moderasiyaya göndərildi",
      listing,
    });
  }),
);

listingRouter.get(
  "/:id/similar",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const current = await prisma.listing.findFirst({
      where: /^[0-9a-f-]{36}$/i.test(req.params.id) ? { OR: [{ id: req.params.id }, { slug: req.params.id }] } : { slug: req.params.id },
      select: { id: true },
    });
    if (!current) throw new HttpError(404, "Elan tapılmadı");
    const items = await similarListings(current.id, req.user?.id);
    res.json({ items });
  }),
);

listingRouter.post(
  "/:id/phone",
  requireAuth,
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findFirst({
      where: /^[0-9a-f-]{36}$/i.test(req.params.id) ? { OR: [{ id: req.params.id }, { slug: req.params.id }] } : { slug: req.params.id },
    });
    if (!listing || listing.status === "DELETED") throw new HttpError(404, "Elan tapılmadı");
    res.json({ phone: listing.phone });
  }),
);

listingRouter.post(
  "/:id/sold",
  requireAuth,
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) throw new HttpError(404, "Elan tapılmadı");
    if (listing.userId !== req.user!.id) throw new HttpError(403, "Bu elanı dəyişmək icazəniz yoxdur");
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { status: "SOLD", soldAt: new Date() },
    });
    res.json({ message: "Elan satıldı kimi işarələndi", status: updated.status, soldAt: updated.soldAt });
  }),
);

listingRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const listing = await getListingBySlugOrId(req.params.id, req.user?.id, true);
    const [rating, reviewCount, activeListings] = await Promise.all([
      prisma.review.aggregate({ where: { revieweeId: listing.user!.id }, _avg: { rating: true }, _count: true }),
      prisma.review.count({ where: { revieweeId: listing.user!.id } }),
      prisma.listing.count({ where: { userId: listing.user!.id, status: "ACTIVE" } }),
    ]);
    res.json({
      listing: {
        ...listing,
        user: {
          ...listing.user,
          rating: rating._avg.rating ? Number(rating._avg.rating.toFixed(1)) : 0,
          reviewCount,
          activeListings,
        },
      },
    });
  }),
);

listingRouter.patch(
  "/:id",
  requireAuth,
  validate(updateListingSchema),
  asyncHandler(async (req, res) => {
    if (req.body.phone) {
      try {
        req.body.phone = normalizePhone(req.body.phone);
      } catch {
        throw new HttpError(400, "Telefon nömrəsi düzgün deyil");
      }
    }
    const isStaff = ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
    const listing = await updateListing(req.params.id, req.user!.id, isStaff, req.body);
    res.json({ message: "Elan yeniləndi", listing });
  }),
);

listingRouter.delete(
  "/:id",
  requireAuth,
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) throw new HttpError(404, "Elan tapılmadı");
    const isStaff = ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
    if (listing.userId !== req.user!.id && !isStaff) throw new HttpError(403, "Bu elanı silmək icazəniz yoxdur");
    await prisma.listing.update({ where: { id: listing.id }, data: { status: "DELETED" } });
    res.json({ message: "Elan silindi" });
  }),
);
