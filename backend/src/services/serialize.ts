import { Prisma } from "@prisma/client";
import { maskPhone } from "../lib/text";
import { isOnline } from "../lib/presence";

const listingWithCard = Prisma.validator<Prisma.ListingDefaultArgs>()({
  include: {
    images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
    videos: true,
    city: { select: { id: true, name: true, slug: true } },
    district: { select: { id: true, name: true, slug: true } },
    category: { select: { id: true, name: true, slug: true, icon: true } },
    subcategory: { select: { id: true, name: true, slug: true } },
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        createdAt: true,
        bio: true,
        city: { select: { id: true, name: true, slug: true } },
      },
    },
    favorites: { select: { userId: true } },
  },
});

export type ListingRecord = Prisma.ListingGetPayload<typeof listingWithCard>;

export const listingInclude = listingWithCard.include;

export function serializeListing(
  listing: ListingRecord,
  options?: { showPhone?: boolean; ownerView?: boolean },
) {
  return {
    id: listing.id,
    publicNumber: listing.publicNumber,
    title: listing.title,
    slug: listing.slug,
    description: listing.description,
    price: Number(listing.price),
    currency: listing.currency,
    condition: listing.condition,
    status: listing.status,
    brand: listing.brand,
    phone: options?.showPhone ? listing.phone : undefined,
    phoneMasked: maskPhone(listing.phone),
    viewCount: listing.viewCount,
    isFeatured: listing.isFeatured,
    rejectionReason: options?.ownerView ? listing.rejectionReason : undefined,
    expiresAt: listing.expiresAt,
    soldAt: listing.soldAt,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    city: listing.city,
    district: listing.district,
    category: listing.category,
    subcategory: listing.subcategory,
    images: listing.images?.map((image) => ({
      id: image.id,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      sortOrder: image.sortOrder,
      isCover: image.isCover,
    })),
    videos: listing.videos?.map((video) => ({ id: video.id, url: video.url })),
    user: listing.user
      ? {
          id: listing.user.id,
          firstName: listing.user.firstName,
          lastName: listing.user.lastName,
          avatarUrl: listing.user.avatarUrl,
          createdAt: listing.user.createdAt,
          bio: listing.user.bio,
          city: listing.user.city,
          isOnline: isOnline(listing.user.id),
        }
      : undefined,
    isFavorite: Boolean(listing.favorites && listing.favorites.length > 0),
  };
}

export function publicUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  bio?: string | null;
  createdAt: Date;
  city?: { id: string; name: string; slug: string } | null;
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    bio: user.bio ?? null,
    createdAt: user.createdAt,
    city: user.city ?? null,
    isOnline: isOnline(user.id),
  };
}
