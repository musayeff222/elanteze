import { ItemCondition, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { placeholderImage } from "../src/lib/media";
import { foldAz, listingSlug } from "../src/lib/text";
import { DEFAULT_SETTINGS } from "../src/services/settings";

const prisma = new PrismaClient();

const cities: { name: string; slug: string; districts: string[] }[] = [
  { name: "Bakı", slug: "baki", districts: ["Yasamal", "Nəsimi", "Nərimanov", "Xətai", "Binəqədi", "Səbail", "Nizami", "Sabunçu"] },
  { name: "Gəncə", slug: "gence", districts: ["Kəpəz", "Nizami"] },
  { name: "Sumqayıt", slug: "sumqayit", districts: ["1-ci mikrorayon", "Corat"] },
  { name: "Mingəçevir", slug: "mingecevir", districts: ["Mərkəz"] },
  { name: "Lənkəran", slug: "lenkeran", districts: ["Mərkəz", "Liman"] },
  { name: "Şəki", slug: "seki", districts: ["Mərkəz"] },
  { name: "Şirvan", slug: "sirvan", districts: ["Mərkəz"] },
  { name: "Naxçıvan", slug: "naxcivan", districts: ["Mərkəz"] },
  { name: "Bərdə", slug: "berde", districts: ["Mərkəz"] },
  { name: "Sabirabad", slug: "sabirabad", districts: ["Mərkəz"] },
];

const categories: { name: string; slug: string; icon: string; children: { name: string; slug: string }[] }[] = [
  { name: "Telefon", slug: "telefon", icon: "Smartphone", children: [{ name: "iPhone", slug: "iphone" }, { name: "Samsung", slug: "samsung" }, { name: "Xiaomi", slug: "xiaomi" }] },
  { name: "Elektronika", slug: "elektronika", icon: "Tv", children: [{ name: "Televizor", slug: "televizor" }, { name: "Audio", slug: "audio" }] },
  { name: "Avtomobil", slug: "avtomobil", icon: "Car", children: [{ name: "Minik", slug: "minik" }, { name: "Ehtiyat hissə", slug: "ehtiyat-hisse" }] },
  { name: "Ev və bağ", slug: "ev-ve-bag", icon: "Home", children: [{ name: "Məişət texnikası", slug: "meiset" }] },
  { name: "Mebel", slug: "mebel", icon: "Sofa", children: [{ name: "Qonaq otağı", slug: "qonaq-otagi" }] },
  { name: "Geyim", slug: "geyim", icon: "Shirt", children: [{ name: "Kişi", slug: "kisi" }, { name: "Qadın", slug: "qadin" }] },
  { name: "Kompüter", slug: "komputer", icon: "Laptop", children: [{ name: "Noutbuk", slug: "noutbuk" }, { name: "Masaüstü", slug: "masaustu" }] },
  { name: "Uşaq", slug: "usaq", icon: "Baby", children: [{ name: "Oyuncaq", slug: "oyuncaq" }] },
  { name: "İdman", slug: "idman", icon: "Dumbbell", children: [{ name: "Velosiped", slug: "velosiped" }] },
  { name: "Xidmətlər", slug: "xidmetler", icon: "Wrench", children: [{ name: "Təmir", slug: "temir" }] },
  { name: "Digər", slug: "diger", icon: "LayoutGrid", children: [{ name: "Müxtəlif", slug: "muxtelif" }] },
];

const colors = ["#0f766e", "#b45309", "#1d4ed8", "#be123c", "#4338ca", "#047857", "#9a3412", "#0e7490"];

type DemoListing = {
  title: string;
  description: string;
  price: number;
  condition: ItemCondition;
  brand?: string;
  category: string;
  subcategory?: string;
  city: string;
  seller: string;
  views: number;
  featured?: boolean;
  status?: "ACTIVE" | "PENDING" | "REJECTED" | "SOLD";
  reason?: string;
  color: string;
};

async function main() {
  const passwordUser = await hashPassword("Istifadeci123!");
  const passwordAdmin = await hashPassword("Admin123!");
  const passwordMod = await hashPassword("Moderator123!");

  const cityRecords = new Map<string, { id: string; name: string; districts: Map<string, string> }>();
  for (let index = 0; index < cities.length; index += 1) {
    const city = cities[index];
    const saved = await prisma.city.upsert({
      where: { slug: city.slug },
      update: { name: city.name, sortOrder: index },
      create: { name: city.name, slug: city.slug, sortOrder: index },
    });
    const districts = new Map<string, string>();
    for (const districtName of city.districts) {
      const slug = foldAz(districtName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const district = await prisma.district.upsert({
        where: { cityId_slug: { cityId: saved.id, slug } },
        update: { name: districtName },
        create: { name: districtName, slug, cityId: saved.id },
      });
      districts.set(districtName, district.id);
    }
    cityRecords.set(city.slug, { id: saved.id, name: saved.name, districts });
  }

  const categoryRecords = new Map<string, { id: string; name: string }>();
  for (let index = 0; index < categories.length; index += 1) {
    const category = categories[index];
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, icon: category.icon, sortOrder: index, isActive: true },
      create: { name: category.name, slug: category.slug, icon: category.icon, sortOrder: index },
    });
    categoryRecords.set(category.slug, { id: saved.id, name: saved.name });
    for (let childIndex = 0; childIndex < category.children.length; childIndex += 1) {
      const child = category.children[childIndex];
      const savedChild = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: saved.id, sortOrder: childIndex, isActive: true },
        create: { name: child.name, slug: child.slug, parentId: saved.id, sortOrder: childIndex },
      });
      categoryRecords.set(child.slug, { id: savedChild.id, name: savedChild.name });
    }
  }

  const baki = cityRecords.get("baki")!;
  const users = [
    { email: "admin@alver.az", phone: "+994501000001", firstName: "Admin", lastName: "ALVER", role: "SUPER_ADMIN" as const, password: passwordAdmin, cityId: baki.id, bio: "Platforma inzibatçısı" },
    { email: "moderator@alver.az", phone: "+994501000002", firstName: "Nigar", lastName: "Əliyeva", role: "MODERATOR" as const, password: passwordMod, cityId: baki.id, bio: "Elan moderatoru" },
    { email: "resad@alver.az", phone: "+994501000003", firstName: "Rəşad", lastName: "Məmmədov", role: "USER" as const, password: passwordUser, cityId: baki.id, bio: "Elektronika və telefon elanları" },
    { email: "leyla@alver.az", phone: "+994501000004", firstName: "Leyla", lastName: "Həsənova", role: "USER" as const, password: passwordUser, cityId: cityRecords.get("gence")!.id, bio: "Ev və geyim elanları" },
    { email: "elvin@alver.az", phone: "+994501000005", firstName: "Elvin", lastName: "Quliyev", role: "USER" as const, password: passwordUser, cityId: cityRecords.get("sumqayit")!.id, bio: "Avtomobil ehtiyat hissələri" },
  ];

  const userIds = new Map<string, string>();
  for (const user of users) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        passwordHash: user.password,
        role: user.role,
        cityId: user.cityId,
        bio: user.bio,
        emailVerified: true,
        phoneVerified: true,
        isBlocked: false,
        deletedAt: null,
        lastSeenAt: new Date(),
      },
      create: {
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: user.password,
        role: user.role,
        cityId: user.cityId,
        bio: user.bio,
        emailVerified: true,
        phoneVerified: true,
        lastSeenAt: new Date(),
      },
    });
    userIds.set(user.email, saved.id);
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  if ((await prisma.listing.count()) > 0) {
    console.log("Demo elanlar artıq var, keçildi.");
    return;
  }

  const demos: DemoListing[] = [
    { title: "iPhone 15 Pro 256GB Natural Titanium", description: "Az işlənib, batareya 96 faizdir. Qutu və orijinal kabeli var. Ciddi alıcılar yaza bilər.", price: 1890, condition: "LIKE_NEW", brand: "Apple", category: "telefon", subcategory: "iphone", city: "baki", seller: "resad@alver.az", views: 240, featured: true, color: colors[0] },
    { title: "Samsung Galaxy S23 128GB", description: "Ekranda cızıq yoxdur, həmişə şüşədə olub. İki nömrə dəstəkləyir.", price: 920, condition: "GOOD", brand: "Samsung", category: "telefon", subcategory: "samsung", city: "baki", seller: "resad@alver.az", views: 120, color: colors[1] },
    { title: "Xiaomi Redmi Note 13 8/256", description: "Yeni, bağlı qutudadır. Zəmanət çeki verilir.", price: 430, condition: "NEW", brand: "Xiaomi", category: "telefon", subcategory: "xiaomi", city: "gence", seller: "leyla@alver.az", views: 80, featured: true, color: colors[2] },
    { title: "LG 55 düym 4K Smart televizor", description: "2022 modeldir. Divar kronşteyni hədiyyədir. Evdən götürmə Bakı, Xətai.", price: 750, condition: "GOOD", brand: "LG", category: "elektronika", subcategory: "televizor", city: "baki", seller: "resad@alver.az", views: 160, featured: true, color: colors[3] },
    { title: "JBL Charge 5 bluetooth dinamik", description: "Səs təmizdir, suya davamlıdır. Çanta ilə birlikdə.", price: 140, condition: "GOOD", brand: "JBL", category: "elektronika", subcategory: "audio", city: "sumqayit", seller: "elvin@alver.az", views: 54, color: colors[4] },
    { title: "Hyundai Elantra 2018 ehtiyat farası", description: "Sol fara, orijinaldır, çatı yoxdur. Sumqayıtdan götürmək olar.", price: 180, condition: "GOOD", brand: "Hyundai", category: "avtomobil", subcategory: "ehtiyat-hisse", city: "sumqayit", seller: "elvin@alver.az", views: 33, color: colors[5] },
    { title: "Toyota Prius 2014, 1.8 hibrid", description: "Texniki baxış keçib. Salon təmizdir. Yalnız baxışla, endirim danışıqla.", price: 21500, condition: "GOOD", brand: "Toyota", category: "avtomobil", subcategory: "minik", city: "baki", seller: "elvin@alver.az", views: 410, featured: true, color: colors[6] },
    { title: "Bosch paltaryuyan maşın 7 kq", description: "İşləkdir, səsi normaldır. 4 ildir evdə istifadə olunur. Özün götür.", price: 320, condition: "FAIR", brand: "Bosch", category: "ev-ve-bag", subcategory: "meiset", city: "baki", seller: "leyla@alver.az", views: 70, color: colors[7] },
    { title: "Künc divan, boz parça", description: "Qonaq otağı üçün geniş künc divan. Ləkə yoxdur, yataq mexanizmi işləyir.", price: 450, condition: "GOOD", brand: "Yerli", category: "mebel", subcategory: "qonaq-otagi", city: "gence", seller: "leyla@alver.az", views: 61, color: colors[0] },
    { title: "Kişi gödəkçə, ölçü L", description: "Payızlıq gödəkçə, bir mövsüm geyinilib. Marka Mavi.", price: 45, condition: "GOOD", brand: "Mavi", category: "geyim", subcategory: "kisi", city: "seki", seller: "elvin@alver.az", views: 18, color: colors[1] },
    { title: "Lenovo IdeaPad 5 noutbuk", description: "Ryzen 5, 16 GB RAM, 512 GB SSD. Ofis və dərs üçün əladır.", price: 980, condition: "LIKE_NEW", brand: "Lenovo", category: "komputer", subcategory: "noutbuk", city: "baki", seller: "resad@alver.az", views: 190, featured: true, color: colors[2] },
    { title: "Uşaq velosipedi 20 düym", description: "6-9 yaş üçün. Əyləcləri yenidir, zəncir yağlanıb.", price: 85, condition: "GOOD", brand: "Stels", category: "idman", subcategory: "velosiped", city: "lenkeran", seller: "leyla@alver.az", views: 27, color: colors[3] },
    { title: "Taxta oyuncaq dəsti", description: "Təhlükəsiz boya ilə, iti hissə yoxdur. Yaş 3+.", price: 25, condition: "NEW", brand: "Local", category: "usaq", subcategory: "oyuncaq", city: "sirvan", seller: "leyla@alver.az", views: 12, color: colors[4] },
    { title: "Kondisioner təmiri və qaz vurulması", description: "Bakı və Sumqayıtda çıxış edirik. Diaqnostika pulsuzdur.", price: 40, condition: "NEW", brand: "ALVER usta", category: "xidmetler", subcategory: "temir", city: "baki", seller: "elvin@alver.az", views: 44, color: colors[5] },
    { title: "Kitab rəfi, palıd rəng", description: "5 mərtəbəli kitab rəfi. Sökülüb aparılır, vintləri tamdır.", price: 60, condition: "FAIR", category: "diger", subcategory: "muxtelif", city: "mingecevir", seller: "resad@alver.az", views: 15, color: colors[6] },
    { title: "iPhone 13 128GB qırmızı", description: "Batareya 88 faiz. Face ID işləyir. Yalnız nağd.", price: 690, condition: "GOOD", brand: "Apple", category: "telefon", subcategory: "iphone", city: "naxcivan", seller: "resad@alver.az", views: 77, color: colors[7] },
    { title: "Gözləmədə olan planşet elanı", description: "Bu elan moderator təsdiqini gözləyir. Samsung planşet, ekran təmizdir, qələmi var.", price: 310, condition: "GOOD", brand: "Samsung", category: "elektronika", subcategory: "televizor", city: "berde", seller: "leyla@alver.az", views: 0, status: "PENDING", color: colors[0] },
    { title: "Rədd edilmiş elan nümunəsi", description: "Bu elan nümunə üçün rədd edilib. Açıqlamada əlaqə qaydası pozulduğu göstərilir.", price: 10, condition: "FOR_PARTS", category: "diger", subcategory: "muxtelif", city: "sabirabad", seller: "elvin@alver.az", views: 2, status: "REJECTED", reason: "Açıqlamada kənar ödəniş linki var", color: colors[1] },
    { title: "Satılmış Nike idman ayaqqabısı", description: "Ölçü 42, bir dəfə geyinilib. Alıcı tapıldığı üçün satıldı.", price: 70, condition: "LIKE_NEW", brand: "Nike", category: "geyim", subcategory: "kisi", city: "baki", seller: "leyla@alver.az", views: 90, status: "SOLD", color: colors[2] },
  ];

  const createdListings: { id: string; slug: string; seller: string; title: string }[] = [];
  for (const demo of demos) {
    const city = cityRecords.get(demo.city)!;
    const districtId = [...city.districts.values()][0];
    const image = await placeholderImage(demo.color);
    const sellerId = userIds.get(demo.seller)!;
    const seller = users.find((item) => item.email === demo.seller)!;
    const category = categoryRecords.get(demo.category)!;
    const subcategory = demo.subcategory ? categoryRecords.get(demo.subcategory) : undefined;
    const row = await prisma.listing.create({
      data: {
        title: demo.title,
        slug: `tmp-${Math.random().toString(36).slice(2)}`,
        description: demo.description,
        price: demo.price,
        condition: demo.condition,
        brand: demo.brand,
        phone: seller.phone,
        categoryId: category.id,
        subcategoryId: subcategory?.id,
        cityId: city.id,
        districtId,
        userId: sellerId,
        status: demo.status || "ACTIVE",
        viewCount: demo.views,
        isFeatured: Boolean(demo.featured),
        rejectionReason: demo.reason,
        soldAt: demo.status === "SOLD" ? new Date() : null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        images: { create: [{ url: image.url, thumbnailUrl: image.thumbnailUrl, isCover: true, sortOrder: 0 }] },
      },
    });
    const slug = listingSlug(demo.title, city.name, row.publicNumber);
    const searchText = foldAz([demo.title, demo.description, demo.brand, category.name, subcategory?.name, city.name, seller.firstName, seller.lastName].filter(Boolean).join(" "));
    await prisma.listing.update({ where: { id: row.id }, data: { slug, searchText } });
    createdListings.push({ id: row.id, slug, seller: demo.seller, title: demo.title });
  }

  const iphone = createdListings[0];
  const buyerId = userIds.get("leyla@alver.az")!;
  const sellerId = userIds.get("resad@alver.az")!;
  const conversation = await prisma.conversation.create({
    data: { listingId: iphone.id, buyerId, sellerId },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conversation.id, senderId: buyerId, body: "Salam, telefon hələ satılırmı?", deliveredAt: new Date(), seenAt: new Date() },
      { conversationId: conversation.id, senderId: sellerId, body: "Salam, bəli. Bu gün Yasamalda baxa bilərsiniz.", deliveredAt: new Date(), seenAt: new Date() },
    ],
  });
  await prisma.review.create({
    data: { reviewerId: buyerId, revieweeId: sellerId, listingId: iphone.id, rating: 5, comment: "Satıcı nəzakətli idi, məlumat düzgün çıxdı." },
  });
  await prisma.favorite.create({ data: { userId: buyerId, listingId: createdListings[6].id } });
  await prisma.offer.create({ data: { listingId: iphone.id, buyerId, amount: 1800, message: "1800 AZN təklif edirəm." } });
  await prisma.report.create({
    data: { listingId: createdListings[13].id, reporterId: buyerId, reason: "WRONG_INFO", details: "Qiymət açıqlama ilə uyğun gəlmir.", status: "OPEN" },
  });
  await prisma.notification.createMany({
    data: [
      { userId: sellerId, type: "NEW_MESSAGE", title: "Yeni mesaj", body: "Leyla Həsənova sizə yazdı.", link: `/mesajlar/${conversation.id}` },
      { userId: sellerId, type: "NEW_OFFER", title: "Yeni təklif", body: "iPhone elanına 1800 AZN təklif gəldi.", link: "/hesab?tab=teklifler" },
      { userId: buyerId, type: "FAVORITE_PRICE_CHANGE", title: "Favori elan", body: "İzlədiyiniz elanı yoxlayın.", link: `/elan/${createdListings[6].slug}`, isRead: true },
    ],
  });

  console.log("ALVER demo məlumatları yazıldı.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
