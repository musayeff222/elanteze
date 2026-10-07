export type Role = "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
export type Condition = "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "FOR_PARTS";
export type ListingStatus = "PENDING" | "ACTIVE" | "REJECTED" | "HIDDEN" | "SOLD" | "EXPIRED" | "DELETED";

export type City = {
  id: string;
  name: string;
  slug: string;
  count?: number;
  districts?: { id: string; name: string; slug: string }[];
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  count?: number;
  children?: Category[];
};

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role?: Role;
  avatarUrl?: string | null;
  bio?: string | null;
  cityId?: string | null;
  city?: { id: string; name: string; slug: string } | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt?: string;
  isOnline?: boolean;
  rating?: number;
  reviewCount?: number;
  activeListings?: number;
  soldListings?: number;
  isBlocked?: boolean;
  lastSeenAt?: string | null;
};

export type ListingImage = {
  id?: string;
  url: string;
  thumbnailUrl: string;
  sortOrder?: number;
  isCover?: boolean;
};

export type Listing = {
  id: string;
  publicNumber?: number;
  title: string;
  slug: string;
  description?: string;
  price: number;
  currency?: string;
  condition: Condition;
  status: ListingStatus;
  brand?: string | null;
  phone?: string;
  phoneMasked?: string;
  viewCount: number;
  isFeatured?: boolean;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  soldAt?: string | null;
  city?: { id: string; name: string; slug: string } | null;
  district?: { id: string; name: string; slug: string } | null;
  category?: { id: string; name: string; slug: string; icon?: string | null } | null;
  subcategory?: { id: string; name: string; slug: string } | null;
  images?: ListingImage[];
  videos?: { id: string; url: string }[];
  user?: User;
  isFavorite?: boolean;
};

export type Settings = {
  siteName: string;
  logoUrl: string;
  faviconUrl: string;
  phone: string;
  email: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  seoTitle: string;
  seoDescription: string;
};

export type Conversation = {
  id: string;
  listing: { id: string; title: string; slug: string; price: number; images?: ListingImage[]; status?: string };
  other: User;
  lastMessage: { body?: string | null; imageUrl?: string | null; createdAt: string; mine?: boolean } | null;
  unread: number;
  lastMessageAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId?: string;
  senderId: string;
  body?: string | null;
  imageUrl?: string | null;
  deliveredAt?: string | null;
  seenAt?: string | null;
  createdAt: string;
  mine?: boolean;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type PageResult<T> = { items: T[]; total: number; page: number; pages: number; limit?: number };
