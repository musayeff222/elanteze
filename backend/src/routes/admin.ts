import { ListingStatus, Prisma, Role } from "@prisma/client";
import { Router } from "express";
import { config } from "../config";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { foldAz, slugify, sanitizeText } from "../lib/text";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { bannerSchema, categorySchema, rejectSchema, reportAdminSchema, settingsSchema, updateCategorySchema, userAdminSchema } from "../schemas";
import { audit, notify } from "../services/notify";
import { DEFAULT_SETTINGS, getSettings } from "../services/settings";
import { favoriteInclude } from "../services/listings";
import { ListingRecord, listingInclude, serializeListing } from "../services/serialize";

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

    const [recentAudit, latestListings, latestReports, latestPeople] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { firstName: true, lastName: true } } },
      }),
      prisma.listing.findMany({
        where: { status: { not: "DELETED" } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, title: true, slug: true, status: true, price: true, createdAt: true },
      }),
      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { listing: { select: { title: true, slug: true } } },
      }),
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
      }),
    ]);

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
      latestListings: latestListings.map((item) => ({ ...item, price: Number(item.price) })),
      latestReports,
      latestPeople,
    });
  }),
);

adminRouter.get(
  "/badges",
  asyncHandler(async (_req, res) => {
    const [pending, reports] = await Promise.all([
      prisma.listing.count({ where: { status: "PENDING" } }),
      prisma.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    ]);
    res.json({ pending, reports });
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

const LISTING_STATUSES: ListingStatus[] = ["PENDING", "ACTIVE", "REJECTED", "HIDDEN", "SOLD", "EXPIRED", "DELETED"];

adminRouter.get(
  "/listings",
  asyncHandler(async (req, res) => {
    const statusRaw = typeof req.query.status === "string" ? req.query.status : "";
    const status = LISTING_STATUSES.includes(statusRaw as ListingStatus) ? (statusRaw as ListingStatus) : undefined;
    const q = String(req.query.q || "").trim();
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const city = typeof req.query.city === "string" ? req.query.city : "";
    const featured = req.query.featured === "1";
    const sort = String(req.query.sort || "new");
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = 12;
    const where: Prisma.ListingWhereInput = {};
    if (featured) where.isFeatured = true;
    if (category) where.category = { OR: [{ id: category }, { slug: category }] };
    if (city) where.city = { OR: [{ id: city }, { slug: city }] };
    if (q) {
      const asNumber = Number(q.replace(/^#/, ""));
      const folded = foldAz(q);
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { searchText: { contains: folded } },
            { brand: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { firstName: { contains: q, mode: "insensitive" } } },
            { user: { lastName: { contains: q, mode: "insensitive" } } },
            ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ publicNumber: asNumber }] : []),
          ],
        },
      ];
    }
    const countedWhere: Prisma.ListingWhereInput = { ...where };
    if (status) where.status = status;
    const orderBy: Prisma.ListingOrderByWithRelationInput =
      sort === "price-asc" ? { price: "asc" } : sort === "price-desc" ? { price: "desc" } : sort === "views" ? { viewCount: "desc" } : { createdAt: "desc" };
    const [total, rows, grouped] = await prisma.$transaction([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        include: {
          ...favoriteInclude(undefined),
          _count: { select: { reports: true, conversations: true, offers: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.listing.groupBy({ by: ["status"], where: countedWhere, _count: { _all: true }, orderBy: { status: "asc" } }),
    ]);
    const counts: Record<string, number> = {};
    for (const item of grouped) {
      const raw = item._count;
      counts[item.status] = raw && typeof raw === "object" ? raw._all || 0 : 0;
    }
    res.json({
      items: rows.map((row) => ({
        ...serializeListing(row as ListingRecord, { showPhone: true, ownerView: true }),
        reports: row._count.reports,
        conversations: row._count.conversations,
        offers: row._count.offers,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts,
    });
  }),
);

adminRouter.get(
  "/listings/:id",
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      include: {
        ...listingInclude,
        favorites: { where: { userId: "__none__" }, select: { userId: true } },
        reports: {
          orderBy: { createdAt: "desc" },
          take: 12,
          include: { reporter: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { reports: true, conversations: true, offers: true, favorites: true } },
      },
    });
    if (!listing) throw new HttpError(404, "Elan tapılmadı");
    res.json({
      listing: serializeListing(listing as ListingRecord, { showPhone: true, ownerView: true }),
      reports: listing.reports.map((report) => ({
        id: report.id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: report.createdAt,
        reporter: report.reporter,
      })),
      counts: listing._count,
    });
  }),
);

adminRouter.post(
  "/listings/bulk",
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? (req.body.ids as string[]) : [];
    const action = String(req.body.action || "");
    if (!ids.length || ids.length > 50) throw new HttpError(400, "Ən çox 50 elan seçin");
    if (!["approve", "hide", "feature", "unfeature", "sold", "restore", "reject"].includes(action)) {
      throw new HttpError(400, "Əməliyyat tanınmadı");
    }
    const reason = sanitizeText(String(req.body.reason || ""));
    if (action === "reject" && reason.length < 3) throw new HttpError(400, "Rədd səbəbini yazın");
    const listings = await prisma.listing.findMany({ where: { id: { in: ids } } });
    for (const listing of listings) {
      if (action === "approve" || action === "restore") {
        const updated = await prisma.listing.update({
          where: { id: listing.id },
          data: {
            status: "ACTIVE",
            rejectionReason: null,
            expiresAt: new Date(Date.now() + config.listingTtlDays * 24 * 60 * 60 * 1000),
            expiryNotified: false,
          },
        });
        if (action === "approve") {
          await notify({
            userId: listing.userId,
            type: "LISTING_APPROVED",
            title: "Elan təsdiqləndi",
            body: `${listing.title} elanı yayımlandı.`,
            link: `/elan/${updated.slug}`,
          });
        }
      } else if (action === "hide") {
        await prisma.listing.update({ where: { id: listing.id }, data: { status: "HIDDEN" } });
      } else if (action === "feature") {
        await prisma.listing.update({ where: { id: listing.id }, data: { isFeatured: true } });
      } else if (action === "unfeature") {
        await prisma.listing.update({ where: { id: listing.id }, data: { isFeatured: false } });
      } else if (action === "sold") {
        await prisma.listing.update({ where: { id: listing.id }, data: { status: "SOLD", soldAt: new Date() } });
      } else if (action === "reject") {
        await prisma.listing.update({ where: { id: listing.id }, data: { status: "REJECTED", rejectionReason: reason } });
        await notify({
          userId: listing.userId,
          type: "LISTING_REJECTED",
          title: "Elan rədd edildi",
          body: `${listing.title}: ${reason}`,
          link: "/hesab",
        });
      }
    }
    await audit({
      actorId: req.user!.id,
      action: "LISTING_BULK",
      entity: "Listing",
      meta: { action, count: listings.length },
    });
    res.json({ message: `${listings.length} elan yeniləndi` });
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

adminRouter.get(
  "/cities",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (_req, res) => {
    const items = await prisma.city.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        districts: { orderBy: { name: "asc" } },
        _count: { select: { listings: true } },
      },
    });
    res.json({ items });
  }),
);

adminRouter.post(
  "/cities",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const name = sanitizeText(String(req.body.name || ""));
    if (name.length < 2) throw new HttpError(400, "Şəhər adını yazın");
    let slug = slugify(name);
    let index = 2;
    while (await prisma.city.findUnique({ where: { slug } })) {
      slug = `${slugify(name)}-${index}`;
      index += 1;
    }
    const city = await prisma.city.create({
      data: { name, slug, sortOrder: Number(req.body.sortOrder || 0) },
    });
    await audit({ actorId: req.user!.id, action: "CITY_CREATE", entity: "City", entityId: city.id });
    res.status(201).json({ message: "Şəhər əlavə edildi", city });
  }),
);

adminRouter.patch(
  "/cities/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const name = req.body.name ? sanitizeText(String(req.body.name)) : undefined;
    const city = await prisma.city.update({
      where: { id: req.params.id },
      data: {
        name,
        sortOrder: req.body.sortOrder === undefined ? undefined : Number(req.body.sortOrder),
      },
    });
    await audit({ actorId: req.user!.id, action: "CITY_UPDATE", entity: "City", entityId: city.id });
    res.json({ message: "Şəhər yeniləndi", city });
  }),
);

adminRouter.delete(
  "/cities/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const [listings, users, districts] = await Promise.all([
      prisma.listing.count({ where: { cityId: req.params.id } }),
      prisma.user.count({ where: { cityId: req.params.id } }),
      prisma.district.count({ where: { cityId: req.params.id } }),
    ]);
    if (listings || users || districts) throw new HttpError(400, "Bu şəhərdə elan, istifadəçi və ya rayon var");
    await prisma.city.delete({ where: { id: req.params.id } });
    await audit({ actorId: req.user!.id, action: "CITY_DELETE", entity: "City", entityId: req.params.id });
    res.json({ message: "Şəhər silindi" });
  }),
);

adminRouter.post(
  "/cities/:id/districts",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const name = sanitizeText(String(req.body.name || ""));
    if (name.length < 2) throw new HttpError(400, "Rayon adını yazın");
    const city = await prisma.city.findUnique({ where: { id: req.params.id } });
    if (!city) throw new HttpError(404, "Şəhər tapılmadı");
    let slug = slugify(name);
    let index = 2;
    while (await prisma.district.findUnique({ where: { cityId_slug: { cityId: city.id, slug } } })) {
      slug = `${slugify(name)}-${index}`;
      index += 1;
    }
    const district = await prisma.district.create({ data: { name, slug, cityId: city.id } });
    await audit({ actorId: req.user!.id, action: "DISTRICT_CREATE", entity: "District", entityId: district.id });
    res.status(201).json({ message: "Rayon əlavə edildi", district });
  }),
);

adminRouter.delete(
  "/districts/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const listings = await prisma.listing.count({ where: { districtId: req.params.id } });
    if (listings) throw new HttpError(400, "Bu rayonda elan var");
    await prisma.district.delete({ where: { id: req.params.id } });
    await audit({ actorId: req.user!.id, action: "DISTRICT_DELETE", entity: "District", entityId: req.params.id });
    res.json({ message: "Rayon silindi" });
  }),
);

adminRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    const items = await prisma.conversation.findMany({
      where: q
        ? {
            OR: [
              { listing: { title: { contains: q, mode: "insensitive" } } },
              { buyer: { firstName: { contains: q, mode: "insensitive" } } },
              { seller: { firstName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      include: {
        listing: { select: { id: true, title: true, slug: true, price: true } },
        buyer: { select: { id: true, firstName: true, lastName: true } },
        seller: { select: { id: true, firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 80,
    });
    res.json({
      items: items.map((item) => ({
        ...item,
        listing: { ...item.listing, price: Number(item.listing.price) },
      })),
    });
  }),
);

adminRouter.get(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        listing: { select: { id: true, title: true, slug: true, price: true } },
        buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
        seller: { select: { id: true, firstName: true, lastName: true, email: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 200, include: { sender: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!conversation) throw new HttpError(404, "Yazışma tapılmadı");
    res.json({
      conversation: {
        ...conversation,
        listing: { ...conversation.listing, price: Number(conversation.listing.price) },
      },
    });
  }),
);

adminRouter.get(
  "/offers",
  asyncHandler(async (_req, res) => {
    const items = await prisma.offer.findMany({
      include: {
        listing: { select: { id: true, title: true, slug: true, price: true } },
        buyer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });
    res.json({
      items: items.map((item) => ({
        ...item,
        amount: Number(item.amount),
        listing: { ...item.listing, price: Number(item.listing.price) },
      })),
    });
  }),
);

adminRouter.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = 30;
    const q = String(req.query.q || "").trim();
    const where: Prisma.AuditLogWhereInput = q
      ? { OR: [{ action: { contains: q, mode: "insensitive" } }, { entity: { contains: q, mode: "insensitive" } }] }
      : {};
    const [total, items] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  }),
);
