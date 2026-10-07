import { z } from "zod";

const phone = z.string().min(9, "Telefon nömrəsi düzgün deyil");
const password = z
  .string()
  .min(8, "Şifrə ən azı 8 simvol olmalıdır")
  .regex(/[A-Za-zƏəİıÖöÜüŞşÇçĞğ]/, "Şifrədə hərf olmalıdır")
  .regex(/\d/, "Şifrədə rəqəm olmalıdır");

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2, "Ad ən azı 2 simvol olmalıdır").max(50),
    lastName: z.string().trim().min(2, "Soyad ən azı 2 simvol olmalıdır").max(50),
    phone,
    email: z.string().trim().email("E-poçt düzgün deyil"),
    password,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email("E-poçt düzgün deyil"),
    password: z.string().min(1, "Şifrə daxil edin"),
  }),
});

export const forgotSchema = z.object({
  body: z.object({ email: z.string().trim().email("E-poçt düzgün deyil") }),
});

export const resetSchema = z.object({
  body: z.object({
    token: z.string().min(10, "Token etibarsızdır"),
    password,
  }),
});

export const verifyPhoneSchema = z.object({
  body: z.object({ code: z.string().regex(/^\d{6}$/, "Kod 6 rəqəmdən ibarət olmalıdır") }),
});

export const profileSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(2).max(50).optional(),
    lastName: z.string().trim().min(2).max(50).optional(),
    bio: z.string().trim().max(500, "Bio 500 simvoldan çox ola bilməz").optional().nullable(),
    cityId: z.string().uuid().optional().nullable(),
    avatarUrl: z.string().optional().nullable(),
  }),
});

export const passwordChangeSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Cari şifrəni daxil edin"),
    newPassword: password,
  }),
});

const imageSchema = z.object({
  url: z.string(),
  thumbnailUrl: z.string(),
  isCover: z.boolean().optional(),
});

const videoSchema = z.object({ url: z.string() });

export const listingBody = z.object({
  title: z.string().trim().min(5, "Başlıq ən azı 5 simvol olmalıdır").max(120),
  description: z.string().trim().min(20, "Açıqlama ən azı 20 simvol olmalıdır").max(5000),
  price: z.number().min(0, "Qiymət mənfi ola bilməz").max(10000000),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "FOR_PARTS"]),
  brand: z.string().trim().max(80).optional().nullable(),
  phone,
  categoryId: z.string().uuid("Kateqoriya seçin"),
  subcategoryId: z.string().uuid().optional().nullable(),
  cityId: z.string().uuid("Şəhər seçin"),
  districtId: z.string().uuid().optional().nullable(),
  images: z.array(imageSchema).min(1, "Ən azı bir şəkil əlavə edin").max(10),
  videos: z.array(videoSchema).max(1).optional(),
});

export const createListingSchema = z.object({ body: listingBody });

export const updateListingSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: listingBody.partial(),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const listingQuerySchema = z.object({
  query: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "FOR_PARTS"]).optional(),
    brand: z.string().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
    date: z.string().optional(),
    sort: z.string().optional(),
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    featured: z.enum(["true", "false"]).optional(),
    sellerId: z.string().uuid().optional(),
  }),
});

export const reportSchema = z.object({
  body: z.object({
    listingId: z.string().uuid(),
    reason: z.enum(["FAKE", "FRAUD", "SPAM", "PROHIBITED", "WRONG_INFO", "INAPPROPRIATE", "OTHER"]),
    details: z.string().trim().max(1000).optional(),
  }),
});

export const reviewSchema = z.object({
  body: z.object({
    listingId: z.string().uuid(),
    revieweeId: z.string().uuid(),
    rating: z.number().int().min(1, "Reytinq 1-5 arası olmalıdır").max(5),
    comment: z.string().trim().max(1000).optional(),
  }),
});

export const messageSchema = z.object({
  body: z.object({
    conversationId: z.string().uuid().optional(),
    listingId: z.string().uuid().optional(),
    body: z.string().trim().max(2000).optional(),
    imageUrl: z.string().optional(),
  }),
});

export const offerSchema = z.object({
  body: z.object({
    listingId: z.string().uuid(),
    amount: z.number().positive("Təklif məbləği 0-dan böyük olmalıdır"),
    message: z.string().trim().max(500).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    icon: z.string().trim().max(40).optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const categorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    icon: z.string().trim().max(40).optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const rejectSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().trim().min(3, "Rədd səbəbini yazın").max(500) }),
});

export const userAdminSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    role: z.enum(["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]).optional(),
    isBlocked: z.boolean().optional(),
  }),
});

export const reportAdminSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]),
    adminNote: z.string().trim().max(1000).optional(),
  }),
});

export const settingsSchema = z.object({
  body: z.object({
    siteName: z.string().trim().min(2).max(40).optional(),
    logoUrl: z.string().max(300).optional(),
    faviconUrl: z.string().max(300).optional(),
    phone: z.string().max(30).optional(),
    email: z.string().trim().email("E-poçt düzgün deyil").optional(),
    whatsapp: z.string().max(30).optional(),
    instagram: z.string().max(200).optional(),
    facebook: z.string().max(200).optional(),
    tiktok: z.string().max(200).optional(),
    seoTitle: z.string().trim().min(2).max(120).optional(),
    seoDescription: z.string().trim().min(2).max(300).optional(),
    autoApproveListings: z.enum(["true", "false"]).optional(),
  }),
});

export const bannerSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(80),
    imageUrl: z.string().min(1),
    link: z.string().optional().nullable(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});
