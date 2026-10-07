import { Router } from "express";
import { HttpError } from "../lib/errors";
import { isManagedUpload } from "../lib/media";
import { prisma } from "../lib/prisma";
import { isOnline } from "../lib/presence";
import { getIo } from "../lib/socketHub";
import { sanitizeText } from "../lib/text";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { messageSchema } from "../schemas";
import { notify } from "../services/notify";

export const messageRouter = Router();
export const conversationRouter = Router();

messageRouter.use(requireAuth);
conversationRouter.use(requireAuth);

async function assertMember(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { id: true, title: true, slug: true, price: true, images: { where: { isCover: true }, take: 1 } } },
      buyer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      seller: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });
  if (!conversation) throw new HttpError(404, "Yazışma tapılmadı");
  if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
    throw new HttpError(403, "Bu yazışmaya baxmaq icazəniz yoxdur");
  }
  return conversation;
}

conversationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await prisma.conversation.findMany({
      where: { OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            price: true,
            status: true,
            images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
          },
        },
        buyer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        seller: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
    });
    const items = await Promise.all(
      rows.map(async (row) => {
        const unread = await prisma.message.count({
          where: { conversationId: row.id, senderId: { not: req.user!.id }, seenAt: null },
        });
        const other = row.buyerId === req.user!.id ? row.seller : row.buyer;
        return {
          id: row.id,
          listing: { ...row.listing, price: Number(row.listing.price) },
          other: { ...other, isOnline: isOnline(other.id) },
          lastMessage: row.messages[0]
            ? { ...row.messages[0], mine: row.messages[0].senderId === req.user!.id }
            : null,
          unread,
          lastMessageAt: row.lastMessageAt,
        };
      }),
    );
    res.json({ items });
  }),
);

conversationRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const listingId = String(req.body.listingId || "");
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== "ACTIVE") throw new HttpError(404, "Elan tapılmadı");
    if (listing.userId === req.user!.id) throw new HttpError(400, "Öz elanınıza mesaj yaza bilməzsiniz");
    const conversation = await prisma.conversation.upsert({
      where: { listingId_buyerId: { listingId: listing.id, buyerId: req.user!.id } },
      update: {},
      create: { listingId: listing.id, buyerId: req.user!.id, sellerId: listing.userId },
    });
    res.status(201).json({ conversationId: conversation.id });
  }),
);

conversationRouter.get(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const conversation = await assertMember(req.params.id, req.user!.id);
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({
      conversation: {
        id: conversation.id,
        listing: { ...conversation.listing, price: Number(conversation.listing.price) },
        buyer: { ...conversation.buyer, isOnline: isOnline(conversation.buyer.id) },
        seller: { ...conversation.seller, isOnline: isOnline(conversation.seller.id) },
      },
      messages: messages.map((message) => ({ ...message, mine: message.senderId === req.user!.id })),
    });
  }),
);

conversationRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await assertMember(req.params.id, req.user!.id);
    const now = new Date();
    await prisma.message.updateMany({
      where: { conversationId: req.params.id, senderId: { not: req.user!.id }, seenAt: null },
      data: { seenAt: now, deliveredAt: now },
    });
    getIo()?.to(`conversation:${req.params.id}`).emit("message:seen", { conversationId: req.params.id, userId: req.user!.id, seenAt: now });
    res.json({ message: "Oxundu kimi işarələndi" });
  }),
);

messageRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const conversationId = String(req.query.conversationId || "");
    if (!conversationId) throw new HttpError(400, "Yazışma seçin");
    await assertMember(conversationId, req.user!.id);
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({ items: messages.map((message) => ({ ...message, mine: message.senderId === req.user!.id })) });
  }),
);

messageRouter.post(
  "/",
  validate(messageSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { conversationId?: string; listingId?: string; body?: string; imageUrl?: string };
    if (!body.body && !body.imageUrl) throw new HttpError(400, "Mesaj və ya şəkil göndərin");
    if (body.imageUrl && !isManagedUpload(body.imageUrl, "image")) throw new HttpError(400, "Şəkil ünvanı etibarsızdır");

    let conversationId = body.conversationId;
    if (!conversationId && body.listingId) {
      const listing = await prisma.listing.findUnique({ where: { id: body.listingId } });
      if (!listing || listing.status !== "ACTIVE") throw new HttpError(404, "Elan tapılmadı");
      if (listing.userId === req.user!.id) throw new HttpError(400, "Öz elanınıza mesaj yaza bilməzsiniz");
      const conversation = await prisma.conversation.upsert({
        where: { listingId_buyerId: { listingId: listing.id, buyerId: req.user!.id } },
        update: {},
        create: { listingId: listing.id, buyerId: req.user!.id, sellerId: listing.userId },
      });
      conversationId = conversation.id;
    }
    if (!conversationId) throw new HttpError(400, "Yazışma və ya elan seçin");

    const conversation = await assertMember(conversationId, req.user!.id);
    const recipientId = conversation.buyerId === req.user!.id ? conversation.sellerId : conversation.buyerId;
    const now = new Date();
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user!.id,
        body: body.body ? sanitizeText(body.body) : null,
        imageUrl: body.imageUrl,
        deliveredAt: isOnline(recipientId) ? now : null,
      },
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
    const payload = { ...message, mine: false };
    getIo()?.to(`conversation:${conversationId}`).emit("message:new", { ...payload, conversationId });
    getIo()?.to(`user:${recipientId}`).emit("message:new", { ...payload, conversationId });
    await notify({
      userId: recipientId,
      type: "NEW_MESSAGE",
      title: "Yeni mesaj",
      body: body.body ? sanitizeText(body.body).slice(0, 140) : "Şəkil göndərildi",
      link: `/mesajlar/${conversationId}`,
    });
    res.status(201).json({ message: { ...message, mine: true }, conversationId });
  }),
);

conversationRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await prisma.message.count({
      where: {
        senderId: { not: req.user!.id },
        seenAt: null,
        conversation: { OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] },
      },
    });
    res.json({ count });
  }),
);
