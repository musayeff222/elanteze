import { ListingStatus, Prisma, Role } from "@prisma/client";
import { Router } from "express";
import { config } from "../config";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { slugify, sanitizeText } from "../lib/text";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { bannerSchema, categorySchema, rejectSchema, reportAdminSchema, settingsSchema, updateCategorySchema, userAdminSchema } from "../schemas";
import { audit, notify } from "../services/notify";
import { DEFAULT_SETTINGS, getSettings } from "../services/settings";
import { favoriteInclude } from "../services/listings";
import { ListingRecord, serializeListing } from "../services/serialize";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN"));

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);

    const [
      usersTotal,
      usersActive,
      listingsTotal,
      listingsActive,
      listingsPending,
      listingsSold,
      reportsOpen,
      messagesTotal,
      recentListings,
      recentUsers,
      byCategory,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isBlocked: false, lastSeenAt: { gte: weekAgo } } }),
      prisma.listing.count({ where: { status: { not: "DELETED" } } }),
      prisma.listing.count({ where: { status: "ACTIVE" } }),
      prisma.listing.count({ where: { status: "PENDING" } }),
      prisma.listing.count({ where: { status: "SOLD" } }),
      prisma.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
      prisma.message.count(),
      prisma.listing.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.category.findMany({
        where: { parentId: null },
        select: { name: true, _count: { select: { listings: { where: { status: { not: "DELETED" } } } } } },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const days: string[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const bucket = (rows: { createdAt: Date }[]) => {
      const map = Object.fromEntries(days.map((day) => [day, 0]));
      for (const row of rows) {
        const key = row.createdAt.toISOString().slice(0, 10);
        if (map[key] !== undefined) map[key] += 1;
      }
      return days.map((date) => ({ date, count: map[date] }));
    };

    const recentAudit = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { firstName: true, lastName: true } } },
    });

    res.json({
      usersTotal,
      usersActive,
      listingsTotal,
      listingsActive,
      listingsPending,
      listingsSold,
      reportsOpen,
      messagesTotal,
      listingsByDay: bucket(recentListings),
      usersByDay: bucket(recentUsers),
      listingsByCategory: byCategory.map((item) => ({ name: item.name, count: item._count.listings })),
      recentAudit,
    });
  }),
);

adminRouter.get(
  "/users",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const role = typeof req.query.role === "string" ? (req.query.role as Role) : undefined;
    const blocked = req.query.blocked === "true" ? true : req.query.blocked === "false" ? false : undefined;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = 20;
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (role) where.role = role;
    if (blocked !== undefined) where.isBlocked = blocked;
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
    }
    const [total, items] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isBlocked: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          lastSeenAt: true,
          avatarUrl: true,
          _count: { select: { listings: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

adminRouter.get(
  "/users/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        city: true,
        listings: {
          where: { status: { not: "DELETED" } },
          include: { images: { take: 1, orderBy: { isCover: "desc" } }, city: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!user || user.deletedAt) throw new HttpError(404, "İstifadəçi tapılmadı");
    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        isBlocked: user.isBlocked,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt,
        city: user.city,
        listings: user.listings.map((listing) => ({ ...listing, price: Number(listing.price) })),
      },
    });
  }),
);

adminRouter.patch(
  "/users/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  validate(userAdminSchema),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) throw new HttpError(400, "Öz hesabınızı bu formada dəyişə bilməzsiniz");
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target || target.deletedAt) throw new HttpError(404, "İstifadəçi tapılmadı");
    const body = req.body as { role?: Role; isBlocked?: boolean };
    if (body.role && (body.role === "ADMIN" || body.role === "SUPER_ADMIN" || target.role === "SUPER_ADMIN" || target.role === "ADMIN")) {
      if (req.user!.role !== "SUPER_ADMIN") throw new HttpError(403, "Bu rolu yalnız baş admin dəyişə bilər");
    }
    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        role: body.role,
        isBlocked: body.isBlocked,
      },
    });
    await audit({ actorId: req.user!.id, action: "USER_UPDATE", entity: "User", entityId: user.id, meta: body });
    res.json({ message: "İstifadəçi yeniləndi", user: { id: user.id, role: user.role, isBlocked: user.isBlocked } });
  }),
);

adminRouter.delete(
  "/users/:id",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) throw new HttpError(400, "Öz hesabınızı silə bilməzsiniz");
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target || target.deletedAt) throw new HttpError(404, "İstifadəçi tapılmadı");
    await prisma.$transaction([
      prisma.listing.updateMany({ where: { userId: target.id, status: { not: "DELETED" } }, data: { status: "HIDDEN" } }),
      prisma.refreshToken.updateMany({ where: { userId: target.id }, data: { revoked: true } }),
      prisma.user.update({
        where: { id: target.id },
        data: {
          deletedAt: new Date(),
          isBlocked: true,
          email: `silinib-${target.id}@alver.local`,
          phone: `deleted-${target.id.slice(0, 18)}`,
          firstName: "Silinmiş",
          lastName: "istifadəçi",
          bio: null,
          avatarUrl: null,
        },
      }),
    ]);
    await audit({ actorId: req.user!.id, action: "USER_DELETE", entity: "User", entityId: target.id });
    res.json({ message: "İstifadəçi silindi" });
  }),
);

adminRouter.get(
  "/listings",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? (req.query.status as ListingStatus) : undefined;
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = 20;
    const where: Prisma.ListingWhereInput = {};
    if (status) where.status = status;
    else where.status = { not: "DELETED" };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }
    const [total, rows] = await prisma.$transaction([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        include: favoriteInclude(undefined),
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({
      items: rows.map((row) => serializeListing(row as ListingRecord, { showPhone: true, ownerView: true })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

async function listingOr404(id: string) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) throw new HttpError(404, "Elan tapılmadı");
  return listing;
}

adminRouter.post(
  "/listings/:id/approve",
  asyncHandler(async (req, res) => {
    const listing = await listingOr404(req.params.id);
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: {
        status: "ACTIVE",
        rejectionReason: null,
        expiresAt: new Date(Date.now() + config.listingTtlDays * 24 * 60 * 60 * 1000),
        expiryNotified: false,
      },
    });
    await notify({
      userId: listing.userId,
      type: "LISTING_APPROVED",
      title: "Elan təsdiqləndi",
      body: `${listing.title} elanı yayımlandı.`,
      link: `/elan/${updated.slug}`,
    });
    await audit({ actorId: req.user!.id, action: "LISTING_APPROVE", entity: "Listing", entityId: listing.id });
    res.json({ message: "Elan təsdiqləndi" });
  }),
);

adminRouter.post(
  "/listings/:id/reject",
  validate(rejectSchema),
  asyncHandler(async (req, res) => {
    const listing = await listingOr404(req.params.id);
    const reason = sanitizeText(req.body.reason as string);
    await prisma.listing.update({ where: { id: listing.id }, data: { status: "REJECTED", rejectionReason: reason } });
    await notify({
      userId: listing.userId,
      type: "LISTING_REJECTED",
      title: "Elan rədd edildi",
      body: `${listing.title}: ${reason}`,
      link: "/hesab",
    });
    await audit({ actorId: req.user!.id, action: "LISTING_REJECT", entity: "Listing", entityId: listing.id, meta: { reason } });
    res.json({ message: "Elan rədd edildi" });
  }),
);

adminRouter.post(
  "/listings/:id/hide",
  asyncHandler(async (req, res) => {
    await listingOr404(req.params.id);
    await prisma.listing.update({ where: { id: req.params.id }, data: { status: "HIDDEN" } });
    await audit({ actorId: req.user!.id, action: "LISTING_HIDE", entity: "Listing", entityId: req.params.id });
    res.json({ message: "Elan gizlədildi" });
  }),
);

adminRouter.post(
  "/listings/:id/restore",
  asyncHandler(async (req, res) => {
    const listing = await listingOr404(req.params.id);
    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        status: "ACTIVE",
        rejectionReason: null,
        expiresAt: new Date(Date.now() + config.listingTtlDays * 24 * 60 * 60 * 1000),
        expiryNotified: false,
      },
    });
    await audit({ actorId: req.user!.id, action: "LISTING_RESTORE", entity: "Listing", entityId: listing.id });
    res.json({ message: "Elan bərpa edildi" });
  }),
);

adminRouter.post(
  "/listings/:id/feature",
  asyncHandler(async (req, res) => {
    const listing = await listingOr404(req.params.id);
    const updated = await prisma.listing.update({ where: { id: listing.id }, data: { isFeatured: !listing.isFeatured } });
    await audit({ actorId: req.user!.id, action: "LISTING_FEATURE", entity: "Listing", entityId: listing.id, meta: { isFeatured: updated.isFeatured } });
    res.json({ message: updated.isFeatured ? "Elan irəli çəkildi" : "İrəli çəkilmə ləğv edildi", isFeatured: updated.isFeatured });
  }),
);

adminRouter.post(
  "/listings/:id/sold",
  asyncHandler(async (req, res) => {
    await listingOr404(req.params.id);
    await prisma.listing.update({ where: { id: req.params.id }, data: { status: "SOLD", soldAt: new Date() } });
    await audit({ actorId: req.user!.id, action: "LISTING_SOLD", entity: "Listing", entityId: req.params.id });
    res.json({ message: "Elan satıldı kimi işarələndi" });
  }),
);

adminRouter.delete(
  "/listings/:id",
  asyncHandler(async (req, res) => {
    await listingOr404(req.params.id);
    await prisma.listing.update({ where: { id: req.params.id }, data: { status: "DELETED" } });
    await audit({ actorId: req.user!.id, action: "LISTING_DELETE", entity: "Listing", entityId: req.params.id });
    res.json({ message: "Elan silindi" });
  }),
);

adminRouter.get(
  "/categories",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    const items = await prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      include: { children: { orderBy: { sortOrder: "asc" } } },
    });
    res.json({ items: items.filter((item) => !item.parentId) });
  }),
);

adminRouter.post(
  "/categories",
  requireRole("ADMIN", "SUPER_ADMIN"),
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { name: string; icon?: string | null; imageUrl?: string | null; parentId?: string | null; sortOrder?: number; isActive?: boolean };
    if (body.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent || parent.parentId) throw new HttpError(400, "Alt kateqoriya yalnız əsas kateqoriyaya bağlana bilər");
    }
    const base = slugify(body.name);
    let slug = base;
    let i = 2;
    while (await prisma.category.findUnique({ where: { slug } })) {
      slug = `${base}-${i}`;
      i += 1;
    }
    const category = await prisma.category.create({
      data: {
        name: sanitizeText(body.name),
        slug,
        icon: body.icon || null,
        imageUrl: body.imageUrl || null,
        parentId: body.parentId || null,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    });
    await audit({ actorId: req.user!.id, action: "CATEGORY_CREATE", entity: "Category", entityId: category.id });
    res.status(201).json({ message: "Kateqoriya yaradıldı", category });
  }),
);

adminRouter.patch(
  "/categories/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const current = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!current) throw new HttpError(404, "Kateqoriya tapılmadı");
    const body = req.body as { name?: string; icon?: string | null; imageUrl?: string | null; parentId?: string | null; sortOrder?: number; isActive?: boolean };
    if (body.parentId) {
      if (body.parentId === current.id) throw new HttpError(400, "Kateqoriya özünə bağlana bilməz");
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent || parent.parentId) throw new HttpError(400, "Yalnız əsas kateqoriya seçilə bilər");
    }
    const category = await prisma.category.update({
      where: { id: current.id },
      data: {
        name: body.name ? sanitizeText(body.name) : undefined,
        icon: body.icon === undefined ? undefined : body.icon,
        imageUrl: body.imageUrl === undefined ? undefined : body.imageUrl,
        parentId: body.parentId === undefined ? undefined : body.parentId,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });
    await audit({ actorId: req.user!.id, action: "CATEGORY_UPDATE", entity: "Category", entityId: category.id });
    res.json({ message: "Kateqoriya yeniləndi", category });
  }),
);

adminRouter.delete(
  "/categories/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const count = await prisma.listing.count({
      where: { OR: [{ categoryId: req.params.id }, { subcategoryId: req.params.id }], status: { not: "DELETED" } },
    });
    const children = await prisma.category.count({ where: { parentId: req.params.id } });
    if (count || children) throw new HttpError(400, "Bu kateqoriyada elan və ya alt kateqoriya var");
    await prisma.category.delete({ where: { id: req.params.id } });
    await audit({ actorId: req.user!.id, action: "CATEGORY_DELETE", entity: "Category", entityId: req.params.id });
    res.json({ message: "Kateqoriya silindi" });
  }),
);

adminRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const items = await prisma.report.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        listing: { select: { id: true, title: true, slug: true, status: true } },
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ items });
  }),
);

adminRouter.patch(
  "/reports/:id",
  validate(reportAdminSchema),
  asyncHandler(async (req, res) => {
    const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { listing: true } });
    if (!report) throw new HttpError(404, "Şikayət tapılmadı");
    const body = req.body as { status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED"; adminNote?: string };
    const updated = await prisma.report.update({
      where: { id: report.id },
      data: {
        status: body.status,
        adminNote: body.adminNote ? sanitizeText(body.adminNote) : report.adminNote,
        resolvedById: body.status === "RESOLVED" || body.status === "DISMISSED" ? req.user!.id : null,
      },
    });
    if (body.status === "RESOLVED" || body.status === "DISMISSED") {
      await notify({
        userId: report.reporterId,
        type: "REPORT_RESULT",
        title: "Şikayət nəticəsi",
        body: body.adminNote ? sanitizeText(body.adminNote) : `${report.listing.title} elanı üzrə şikayətiniz nəzərdən keçirildi.`,
        link: `/elan/${report.listing.slug}`,
      });
    }
    await audit({ actorId: req.user!.id, action: "REPORT_UPDATE", entity: "Report", entityId: report.id, meta: { status: body.status } });
    res.json({ message: "Şikayət yeniləndi", report: updated });
  }),
);

adminRouter.get(
  "/reviews",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    const items = await prisma.review.findMany({
      include: {
        reviewer: { select: { firstName: true, lastName: true } },
        reviewee: { select: { firstName: true, lastName: true } },
        listing: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ items });
  }),
);

adminRouter.delete(
  "/reviews/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.review.delete({ where: { id: req.params.id } });
    await audit({ actorId: req.user!.id, action: "REVIEW_DELETE", entity: "Review", entityId: req.params.id });
    res.json({ message: "Rəy silindi" });
  }),
);

adminRouter.get(
  "/settings",
  requireRole("SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    res.json(await getSettings());
  }),
);

adminRouter.patch(
  "/settings",
  requireRole("SUPER_ADMIN"),
  validate(settingsSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, string>;
    const entries = Object.entries(body).filter(([key, value]) => key in DEFAULT_SETTINGS && value !== undefined);
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.siteSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        }),
      ),
    );
    await audit({ actorId: req.user!.id, action: "SETTINGS_UPDATE", entity: "SiteSetting", meta: body });
    res.json({ message: "Tənzimləmələr yadda saxlandı", settings: await getSettings() });
  }),
);

adminRouter.get(
  "/banners",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    const items = await prisma.banner.findMany({ orderBy: { sortOrder: "asc" } });
    res.json({ items });
  }),
);

adminRouter.post(
  "/banners",
  requireRole("ADMIN", "SUPER_ADMIN"),
  validate(bannerSchema),
  asyncHandler(async (req, res) => {
    const banner = await prisma.banner.create({ data: req.body });
    res.status(201).json({ message: "Banner əlavə edildi", banner });
  }),
);

adminRouter.patch(
  "/banners/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const banner = await prisma.banner.update({ where: { id: req.params.id }, data: req.body });
    res.json({ message: "Banner yeniləndi", banner });
  }),
);

adminRouter.delete(
  "/banners/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.banner.delete({ where: { id: req.params.id } });
    res.json({ message: "Banner silindi" });
  }),
);
