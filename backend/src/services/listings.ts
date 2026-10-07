import { ItemCondition, ListingStatus, Prisma } from "@prisma/client";
import { config } from "../config";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { foldAz, listingSlug, sanitizeText } from "../lib/text";
import { isManagedUpload } from "../lib/media";
import { notify } from "./notify";
import { getSettings } from "./settings";
import { listingInclude, ListingRecord, serializeListing } from "./serialize";

export type ImageInput = { url: string; thumbnailUrl: string; isCover?: boolean };
export type VideoInput = { url: string };

const SORTS: Record<string, Prisma.ListingOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  "en-yeni": { createdAt: "desc" },
  cheapest: { price: "asc" },
  "en-ucuz": { price: "asc" },
  expensive: { price: "desc" },
  "en-bahali": { price: "desc" },
  views: { viewCount: "desc" },
  "en-cox-baxilan": { viewCount: "desc" },
};

export function parseSort(sort?: string): Prisma.ListingOrderByWithRelationInput {
  if (!sort) return { createdAt: "desc" };
  return SORTS[sort] || { createdAt: "desc" };
}

export function dateFromFilter(date?: string): Date | undefined {
  if (!date || date === "hamisi") return undefined;
  const now = new Date();
  if (date === "bu-gun" || date === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (date === "hefte" || date === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (date === "ay" || date === "month") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function assertUploads(images: ImageInput[], videos: VideoInput[]) {
  if (images.length < 1) throw new HttpError(400, "Ən azı bir şəkil əlavə edin");
  if (images.length > 10) throw new HttpError(400, "Ən çox 10 şəkil yükləmək olar");
  if (videos.length > 1) throw new HttpError(400, "Ən çox 1 video yükləmək olar");
  for (const image of images) {
    if (!isManagedUpload(image.url, "image") || !isManagedUpload(image.thumbnailUrl, "image")) {
      throw new HttpError(400, "Şəkil ünvanı etibarsızdır");
    }
  }
  for (const video of videos) {
    if (!isManagedUpload(video.url, "video")) throw new HttpError(400, "Video ünvanı etibarsızdır");
  }
}

async function resolveTaxonomy(input: {
  categoryId: string;
  subcategoryId?: string | null;
  cityId: string;
  districtId?: string | null;
}) {
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, parentId: null, isActive: true },
  });
  if (!category) throw new HttpError(400, "Kateqoriya tapılmadı");

  let subcategory = null;
  if (input.subcategoryId) {
    subcategory = await prisma.category.findFirst({
      where: { id: input.subcategoryId, parentId: category.id, isActive: true },
    });
    if (!subcategory) throw new HttpError(400, "Alt kateqoriya bu kateqoriyaya aid deyil");
  }

  const city = await prisma.city.findUnique({ where: { id: input.cityId }, include: { districts: true } });
  if (!city) throw new HttpError(400, "Şəhər tapılmadı");
  let district = null;
  if (city.districts.length > 0 && !input.districtId) {
    throw new HttpError(400, "Rayon seçin");
  }
  if (input.districtId) {
    district = city.districts.find((item) => item.id === input.districtId) || null;
    if (!district) throw new HttpError(400, "Rayon bu şəhərə aid deyil");
  }
  return { category, subcategory, city, district };
}

function buildSearchText(parts: Array<string | null | undefined>): string {
  return foldAz(parts.filter(Boolean).join(" "));
}

export async function createListing(
  userId: string,
  input: {
    title: string;
    description: string;
    price: number;
    condition: ItemCondition;
    brand?: string | null;
    phone: string;
    categoryId: string;
    subcategoryId?: string | null;
    cityId: string;
    districtId?: string | null;
    images: ImageInput[];
    videos?: VideoInput[];
  },
) {
  const images = input.images || [];
  const videos = input.videos || [];
  assertUploads(images, videos);
  const taxonomy = await resolveTaxonomy(input);
  const settings = await getSettings();
  const status: ListingStatus = settings.autoApproveListings === "true" ? "ACTIVE" : "PENDING";
  const coverIndex = Math.max(
    0,
    images.findIndex((image) => image.isCover),
  );
  const expiresAt = new Date(Date.now() + config.listingTtlDays * 24 * 60 * 60 * 1000);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const created = await prisma.listing.create({
    data: {
      title: sanitizeText(input.title),
      slug: `tmp-${cryptoRandom()}`,
      description: sanitizeText(input.description),
      price: input.price,
      condition: input.condition,
      brand: input.brand ? sanitizeText(input.brand) : null,
      phone: input.phone,
      categoryId: taxonomy.category.id,
      subcategoryId: taxonomy.subcategory?.id,
      cityId: taxonomy.city.id,
      districtId: taxonomy.district?.id,
      userId,
      status,
      expiresAt,
      images: {
        create: images.map((image, index) => ({
          url: image.url,
          thumbnailUrl: image.thumbnailUrl,
          sortOrder: index,
          isCover: index === coverIndex,
        })),
      },
      videos: { create: videos.map((video) => ({ url: video.url })) },
    },
  });

  const slug = listingSlug(created.title, taxonomy.city.name, created.publicNumber);
  const searchText = buildSearchText([
    created.title,
    input.description,
    input.brand,
    taxonomy.category.name,
    taxonomy.subcategory?.name,
    taxonomy.city.name,
    taxonomy.district?.name,
    user?.firstName,
    user?.lastName,
  ]);

  const listing = await prisma.listing.update({
    where: { id: created.id },
    data: { slug, searchText },
    include: favoriteInclude(userId),
  });
  return serializeListing(listing as ListingRecord, { showPhone: true, ownerView: true });
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function favoriteInclude(userId?: string) {
  return {
    ...listingInclude,
    favorites: userId ? { where: { userId }, select: { userId: true } } : { where: { userId: "__none__" }, select: { userId: true } },
  };
}

export async function queryListings(params: {
  q?: string;
  category?: string;
  subcategory?: string;
  city?: string;
  district?: string;
  condition?: ItemCondition;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  date?: string;
  sort?: string;
  page?: number;
  limit?: number;
  featured?: boolean;
  userId?: string;
  status?: ListingStatus;
  sellerId?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const folded = params.q ? foldAz(params.q) : "";
  const where: Prisma.ListingWhereInput = {
    status: params.status || "ACTIVE",
  };
  if (params.sellerId) where.userId = params.sellerId;
  if (params.featured) where.isFeatured = true;
  if (params.condition) where.condition = params.condition;
  if (params.brand) where.brand = { contains: params.brand, mode: "insensitive" };
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.price = {};
    if (params.minPrice !== undefined) where.price.gte = params.minPrice;
    if (params.maxPrice !== undefined) where.price.lte = params.maxPrice;
  }
  const from = dateFromFilter(params.date);
  if (from) where.createdAt = { gte: from };
  if (params.category) {
    where.category = { OR: [{ id: params.category }, { slug: params.category }] };
  }
  if (params.subcategory) {
    where.subcategory = { OR: [{ id: params.subcategory }, { slug: params.subcategory }] };
  }
  if (params.city) where.city = { OR: [{ id: params.city }, { slug: params.city }] };
  if (params.district) where.district = { OR: [{ id: params.district }, { slug: params.district }] };
  if (params.q) {
    where.OR = [
      { searchText: { contains: folded } },
      { title: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
      { brand: { contains: params.q, mode: "insensitive" } },
      { category: { name: { contains: params.q, mode: "insensitive" } } },
      { user: { firstName: { contains: params.q, mode: "insensitive" } } },
      { user: { lastName: { contains: params.q, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      include: favoriteInclude(params.userId),
      orderBy: parseSort(params.sort),
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map((row) => serializeListing(row as ListingRecord)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    limit,
  };
}

export async function getListingBySlugOrId(idOrSlug: string, viewerId?: string, countView = false) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const listing = await prisma.listing.findFirst({
    where: isUuid ? { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } : { slug: idOrSlug },
    include: favoriteInclude(viewerId),
  });
  if (!listing || listing.status === "DELETED") throw new HttpError(404, "Elan tapılmadı");
  const isOwner = viewerId === listing.userId;
  const viewer = viewerId
    ? await prisma.user.findUnique({ where: { id: viewerId }, select: { role: true } })
    : null;
  const isStaff = viewer && ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(viewer.role);
  if (listing.status !== "ACTIVE" && !isOwner && !isStaff) {
    throw new HttpError(404, "Elan tapılmadı");
  }
  if (countView && listing.status === "ACTIVE" && !isOwner) {
    await prisma.listing.update({ where: { id: listing.id }, data: { viewCount: { increment: 1 } } });
    listing.viewCount += 1;
  }
  return serializeListing(listing as ListingRecord, { showPhone: isOwner || Boolean(isStaff), ownerView: isOwner || Boolean(isStaff) });
}

export async function updateListing(
  listingId: string,
  actorId: string,
  isStaff: boolean,
  input: Partial<{
    title: string;
    description: string;
    price: number;
    condition: ItemCondition;
    brand: string | null;
    phone: string;
    categoryId: string;
    subcategoryId: string | null;
    cityId: string;
    districtId: string | null;
    images: ImageInput[];
    videos: VideoInput[];
  }>,
) {
  const existing = await prisma.listing.findUnique({ where: { id: listingId }, include: { user: true, city: true } });
  if (!existing || existing.status === "DELETED") throw new HttpError(404, "Elan tapılmadı");
  if (!isStaff && existing.userId !== actorId) throw new HttpError(403, "Bu elanı dəyişmək icazəniz yoxdur");

  const nextCategory = input.categoryId || existing.categoryId;
  const nextSub = input.subcategoryId === undefined ? existing.subcategoryId : input.subcategoryId;
  const nextCity = input.cityId || existing.cityId;
  const nextDistrict = input.districtId === undefined ? existing.districtId : input.districtId;
  const taxonomy = await resolveTaxonomy({
    categoryId: nextCategory,
    subcategoryId: nextSub,
    cityId: nextCity,
    districtId: nextDistrict,
  });

  if (input.images) assertUploads(input.images, input.videos || []);
  const priceChanged = input.price !== undefined && Number(existing.price) !== input.price;
  const resubmit = !isStaff && (existing.status === "REJECTED" || existing.status === "EXPIRED");

  const data: Prisma.ListingUpdateInput = {
    category: { connect: { id: taxonomy.category.id } },
    subcategory: taxonomy.subcategory ? { connect: { id: taxonomy.subcategory.id } } : { disconnect: true },
    city: { connect: { id: taxonomy.city.id } },
    district: taxonomy.district ? { connect: { id: taxonomy.district.id } } : { disconnect: true },
  };
  if (input.title) data.title = sanitizeText(input.title);
  if (input.description) data.description = sanitizeText(input.description);
  if (input.price !== undefined) data.price = input.price;
  if (input.condition) data.condition = input.condition;
  if (input.brand !== undefined) data.brand = input.brand ? sanitizeText(input.brand) : null;
  if (input.phone) data.phone = input.phone;
  if (resubmit) {
    const settings = await getSettings();
    data.status = settings.autoApproveListings === "true" ? "ACTIVE" : "PENDING";
    data.rejectionReason = null;
    data.expiresAt = new Date(Date.now() + config.listingTtlDays * 24 * 60 * 60 * 1000);
    data.expiryNotified = false;
  }

  const title = input.title ? sanitizeText(input.title) : existing.title;
  const description = input.description ? sanitizeText(input.description) : existing.description;
  data.searchText = buildSearchText([
    title,
    description,
    input.brand === undefined ? existing.brand : input.brand,
    taxonomy.category.name,
    taxonomy.subcategory?.name,
    taxonomy.city.name,
    taxonomy.district?.name,
    existing.user.firstName,
    existing.user.lastName,
  ]);

  await prisma.$transaction(async (tx) => {
    if (input.images) {
      await tx.listingImage.deleteMany({ where: { listingId } });
      const coverIndex = Math.max(0, input.images.findIndex((image) => image.isCover));
      await tx.listingImage.createMany({
        data: input.images.map((image, index) => ({
          listingId,
          url: image.url,
          thumbnailUrl: image.thumbnailUrl,
          sortOrder: index,
          isCover: index === coverIndex,
        })),
      });
    }
    if (input.videos) {
      await tx.listingVideo.deleteMany({ where: { listingId } });
      if (input.videos.length) {
        await tx.listingVideo.createMany({
          data: input.videos.map((video) => ({ listingId, url: video.url })),
        });
      }
    }
    await tx.listing.update({ where: { id: listingId }, data });
  });

  if (priceChanged && input.price !== undefined) {
    const favorites = await prisma.favorite.findMany({ where: { listingId } });
    await Promise.all(
      favorites
        .filter((fav) => fav.userId !== existing.userId)
        .map((fav) =>
          notify({
            userId: fav.userId,
            type: "FAVORITE_PRICE_CHANGE",
            title: "Favori elanın qiyməti dəyişdi",
            body: `${existing.title} elanının yeni qiyməti ${input.price} AZN oldu.`,
            link: `/elan/${existing.slug}`,
          }),
        ),
    );
  }

  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: favoriteInclude(actorId),
  });
  return serializeListing(listing as ListingRecord, { showPhone: true, ownerView: true });
}

export async function similarListings(listingId: string, viewerId?: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return [];
  const rows = await prisma.listing.findMany({
    where: {
      id: { not: listingId },
      status: "ACTIVE",
      OR: [
        { subcategoryId: listing.subcategoryId || undefined },
        { categoryId: listing.categoryId },
      ],
    },
    include: favoriteInclude(viewerId),
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return rows.map((row) => serializeListing(row as ListingRecord));
}

export async function runExpiryJob() {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expiring = await prisma.listing.findMany({
    where: { status: "ACTIVE", expiryNotified: false, expiresAt: { lte: soon, gt: now } },
    select: { id: true, userId: true, title: true, slug: true },
  });
  for (const listing of expiring) {
    await notify({
      userId: listing.userId,
      type: "LISTING_EXPIRING",
      title: "Elanın müddəti bitir",
      body: `${listing.title} elanının müddəti 24 saat ərzində bitir.`,
      link: `/hesab`,
    });
    await prisma.listing.update({ where: { id: listing.id }, data: { expiryNotified: true } });
  }
  await prisma.listing.updateMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
}
