import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/prisma";

const app = createApp();
const stamp = Date.now();
const password = "Test1234a";
const userEmail = `user${stamp}@alver.test`;
const adminEmail = `admin${stamp}@alver.test`;

let categoryId = "";
let cityId = "";
let districtId = "";
let listingId = "";
let buyerAgent: request.SuperAgentTest;
let adminAgent: request.SuperAgentTest;

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

beforeAll(async () => {
  const city = await prisma.city.create({
    data: { name: `Test şəhər ${stamp}`, slug: `test-seher-${stamp}`, districts: { create: { name: "Mərkəz", slug: "merkez" } } },
    include: { districts: true },
  });
  cityId = city.id;
  districtId = city.districts[0].id;
  const category = await prisma.category.create({
    data: { name: `Test kat ${stamp}`, slug: `test-kat-${stamp}`, children: { create: { name: "Alt", slug: `test-alt-${stamp}` } } },
  });
  categoryId = category.id;

  buyerAgent = request.agent(app);
  const registered = await buyerAgent.post("/api/auth/register").send({
    firstName: "Test",
    lastName: "İstifadəçi",
    phone: `050${String(stamp).slice(-7)}`,
    email: userEmail,
    password,
  });
  expect(registered.status).toBe(201);
  await prisma.user.update({ where: { email: userEmail }, data: { emailVerified: true } });
  const buyerLogin = await buyerAgent.post("/api/auth/login").send({ email: userEmail, password });
  expect(buyerLogin.status).toBe(200);

  await prisma.user.create({
    data: {
      firstName: "Test",
      lastName: "Admin",
      email: adminEmail,
      phone: `+99455${String(stamp).slice(-7)}`,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      emailVerified: true,
      phoneVerified: true,
    },
  });
  adminAgent = request.agent(app);
  const login = await adminAgent.post("/api/auth/login").send({ email: adminEmail, password });
  expect(login.status).toBe(200);
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { endsWith: "@alver.test" } } });
  const ids = users.map((user) => user.id);
  await prisma.message.deleteMany({ where: { senderId: { in: ids } } });
  await prisma.conversation.deleteMany({ where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.favorite.deleteMany({ where: { userId: { in: ids } } });
  await prisma.review.deleteMany({ where: { OR: [{ reviewerId: { in: ids } }, { revieweeId: { in: ids } }] } });
  await prisma.report.deleteMany({ where: { reporterId: { in: ids } } });
  await prisma.offer.deleteMany({ where: { buyerId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  if (listingId) await prisma.listing.deleteMany({ where: { id: listingId } });
  await prisma.listing.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.category.deleteMany({ where: { parentId: categoryId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.city.deleteMany({ where: { id: cityId } });
  await prisma.$disconnect();
});

describe("ALVER API", () => {
  it("qeydiyyat və sessiya işləyir", async () => {
    const me = await buyerAgent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(userEmail);
  });

  it("elan, favori, mesaj, şikayət və rəy işləyir", async () => {
    const upload = await buyerAgent.post("/api/uploads/image").attach("file", png, "sekil.png");
    expect(upload.status).toBe(201);
    const created = await buyerAgent.post("/api/listings").send({
      title: "Test telefon elanı",
      description: "Bu test elanının açıqlaması kifayət qədər uzundur.",
      price: 100,
      condition: "GOOD",
      brand: "TestBrand",
      phone: "+994501112233",
      categoryId,
      cityId,
      districtId,
      images: [{ url: upload.body.url, thumbnailUrl: upload.body.thumbnailUrl, isCover: true }],
    });
    expect(created.status).toBe(201);
    listingId = created.body.listing.id;
    expect(created.body.listing.slug).toContain("test-telefon");

    await prisma.listing.update({ where: { id: listingId }, data: { status: "ACTIVE" } });
    const second = request.agent(app);
    const otherEmail = `other${stamp}@alver.test`;
    await second.post("/api/auth/register").send({
      firstName: "Digər",
      lastName: "Alıcı",
      phone: `070${String(stamp).slice(-7)}`,
      email: otherEmail,
      password,
    });
    await prisma.user.update({ where: { email: otherEmail }, data: { emailVerified: true } });
    await second.post("/api/auth/login").send({ email: otherEmail, password });

    const fav = await second.post(`/api/favorites/${listingId}`);
    expect(fav.status).toBe(201);
    const favList = await second.get("/api/favorites");
    expect(favList.body.items.length).toBeGreaterThan(0);

    const search = await second.get("/api/listings").query({ q: "TestBrand" });
    expect(search.status).toBe(200);
    expect(search.body.items.some((item: { id: string }) => item.id === listingId)).toBe(true);

    const message = await second.post("/api/messages").send({ listingId, body: "Salam, elan aktualdır?" });
    expect(message.status).toBe(201);
    const messages = await second.get("/api/messages").query({ conversationId: message.body.conversationId });
    expect(messages.body.items.length).toBe(1);

    const report = await second.post("/api/reports").send({ listingId, reason: "SPAM", details: "Test şikayəti" });
    expect(report.status).toBe(201);

    const review = await second.post("/api/reviews").send({
      listingId,
      revieweeId: created.body.listing.user.id,
      rating: 5,
      comment: "Yaxşı satıcı",
    });
    expect(review.status).toBe(201);

    const forbidden = await second.get("/api/admin/stats");
    expect(forbidden.status).toBe(403);

    const stats = await adminAgent.get("/api/admin/stats");
    expect(stats.status).toBe(200);
    expect(stats.body.usersTotal).toBeGreaterThan(0);
  });

  it("şifrə bərpası tokeni qaytarır", async () => {
    const forgot = await request(app).post("/api/auth/forgot-password").send({ email: userEmail });
    expect(forgot.status).toBe(200);
    expect(forgot.body.devResetLink).toContain("token=");
  });
});
