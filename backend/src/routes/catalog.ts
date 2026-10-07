import { Router } from "express";
import { foldAz } from "../lib/text";
import { prisma } from "../lib/prisma";
import { isOnline } from "../lib/presence";
import { asyncHandler } from "../middleware/asyncHandler";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { queryListings } from "../services/listings";
import { getPublicSettings } from "../services/settings";
import { publicUser } from "../services/serialize";

export const catalogRouter = Router();

catalogRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: "asc" },
      include: {
        children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    res.json({ items: rows });
  }),
);

catalogRouter.get(
  "/cities",
  asyncHandler(async (_req, res) => {
    const items = await prisma.city.findMany({
      orderBy: { sortOrder: "asc" },
      include: { districts: { orderBy: { name: "asc" } } },
    });
    res.json({ items });
  }),
);

catalogRouter.get(
  "/banners",
  asyncHandler(async (_req, res) => {
    const items = await prisma.banner.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    res.json({ items });
  }),
);

catalogRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    res.json(await getPublicSettings());
  }),
);

catalogRouter.get(
  "/brands",
  asyncHandler(async (req, res) => {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const rows = await prisma.listing.findMany({
      where: {
        status: "ACTIVE",
        brand: { not: null },
        ...(category ? { category: { OR: [{ id: category }, { slug: category }] } } : {}),
      },
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
      take: 40,
    });
    res.json({ items: rows.map((row) => row.brand).filter(Boolean) });
  }),
);

catalogRouter.get(
  "/search/suggest",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      res.json({ listings: [], categories: [] });
      return;
    }
    const folded = foldAz(q);
    const [listings, categories] = await Promise.all([
      prisma.listing.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ searchText: { contains: folded } }, { title: { contains: q, mode: "insensitive" } }],
        },
        select: { id: true, title: true, slug: true, price: true, city: { select: { name: true } } },
        take: 6,
        orderBy: { viewCount: "desc" },
      }),
      prisma.category.findMany({
        where: { isActive: true, name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, slug: true, parentId: true },
        take: 5,
      }),
    ]);
    res.json({
      listings: listings.map((item) => ({ ...item, price: Number(item.price) })),
      categories,
    });
  }),
);

catalogRouter.get(
  "/home",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const city = typeof req.query.city === "string" ? req.query.city : undefined;
    const viewer = req.user?.id;
    const [latest, popular, recommended, cityListings, cities, categories] = await Promise.all([
      queryListings({ limit: 8, sort: "newest", userId: viewer, city }),
      queryListings({ limit: 8, sort: "views", userId: viewer }),
      queryListings({ limit: 8, featured: true, userId: viewer }),
      city ? queryListings({ limit: 8, city, userId: viewer, sort: "newest" }) : Promise.resolve(null),
      prisma.city.findMany({
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { listings: { where: { status: "ACTIVE" } } } } },
      }),
      prisma.category.findMany({
        where: { isActive: true, parentId: null },
        orderBy: { sortOrder: "asc" },
        include: { children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }, _count: { select: { listings: { where: { status: "ACTIVE" } } } } },
      }),
    ]);
    res.json({
      latest: latest.items,
      popular: popular.items,
      recommended: recommended.items.length ? recommended.items : latest.items,
      cityListings: cityListings?.items || [],
      cities: cities.map((item) => ({ id: item.id, name: item.name, slug: item.slug, count: item._count.listings })),
      categories: categories.map((item) => ({ ...item, count: item._count.listings })),
    });
  }),
);

catalogRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null, isBlocked: false },
      include: { city: { select: { id: true, name: true, slug: true } } },
    });
    if (!user) {
      res.status(404).json({ message: "İstifadəçi tapılmadı" });
      return;
    }
    const [agg, activeCount, soldCount] = await Promise.all([
      prisma.review.aggregate({ where: { revieweeId: user.id }, _avg: { rating: true }, _count: true }),
      prisma.listing.count({ where: { userId: user.id, status: "ACTIVE" } }),
      prisma.listing.count({ where: { userId: user.id, status: "SOLD" } }),
    ]);
    res.json({
      user: {
        ...publicUser(user),
        rating: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
        reviewCount: agg._count,
        activeListings: activeCount,
        soldListings: soldCount,
        isOnline: isOnline(user.id),
      },
    });
  }),
);

catalogRouter.get(
  "/users/:id/listings",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const status = req.query.status === "SOLD" ? "SOLD" : "ACTIVE";
    const result = await queryListings({
      sellerId: req.params.id,
      status,
      userId: req.user?.id,
      page: Number(req.query.page || 1),
      limit: 12,
    });
    res.json(result);
  }),
);

catalogRouter.get(
  "/badges",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [messages, notifications] = await Promise.all([
      prisma.message.count({
        where: {
          senderId: { not: req.user!.id },
          seenAt: null,
          conversation: { OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] },
        },
      }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);
    res.json({ messages, notifications });
  }),
);

catalogRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", name: "ALVER" });
});
