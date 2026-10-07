import { Router } from "express";
import { HttpError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { sanitizeText } from "../lib/text";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { offerSchema } from "../schemas";
import { notify } from "../services/notify";

export const offerRouter = Router();
offerRouter.use(requireAuth);

offerRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [sent, received] = await Promise.all([
      prisma.offer.findMany({
        where: { buyerId: req.user!.id },
        include: { listing: { select: { id: true, title: true, slug: true, price: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.offer.findMany({
        where: { listing: { userId: req.user!.id } },
        include: {
          listing: { select: { id: true, title: true, slug: true, price: true } },
          buyer: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    res.json({
      sent: sent.map((row) => ({ ...row, amount: Number(row.amount), listing: { ...row.listing, price: Number(row.listing.price) } })),
      received: received.map((row) => ({ ...row, amount: Number(row.amount), listing: { ...row.listing, price: Number(row.listing.price) } })),
    });
  }),
);

offerRouter.post(
  "/",
  validate(offerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { listingId: string; amount: number; message?: string };
    const listing = await prisma.listing.findUnique({ where: { id: body.listingId } });
    if (!listing || listing.status !== "ACTIVE") throw new HttpError(404, "Elan tapılmadı");
    if (listing.userId === req.user!.id) throw new HttpError(400, "Öz elanınıza təklif edə bilməzsiniz");
    const offer = await prisma.offer.create({
      data: {
        listingId: listing.id,
        buyerId: req.user!.id,
        amount: body.amount,
        message: body.message ? sanitizeText(body.message) : null,
      },
    });
    await notify({
      userId: listing.userId,
      type: "NEW_OFFER",
      title: "Yeni təklif",
      body: `${listing.title} elanına ${body.amount} AZN təklif gəldi.`,
      link: `/hesab?tab=teklifler`,
    });
    res.status(201).json({ message: "Təklif göndərildi", offer: { ...offer, amount: Number(offer.amount) } });
  }),
);

offerRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const status = req.body.status as "ACCEPTED" | "REJECTED";
    if (status !== "ACCEPTED" && status !== "REJECTED") throw new HttpError(400, "Status düzgün deyil");
    const offer = await prisma.offer.findUnique({ where: { id: req.params.id }, include: { listing: true } });
    if (!offer) throw new HttpError(404, "Təklif tapılmadı");
    if (offer.listing.userId !== req.user!.id) throw new HttpError(403, "Bu təklifi idarə etmək icazəniz yoxdur");
    const updated = await prisma.offer.update({ where: { id: offer.id }, data: { status } });
    await notify({
      userId: offer.buyerId,
      type: "NEW_OFFER",
      title: status === "ACCEPTED" ? "Təklifiniz qəbul edildi" : "Təklifiniz rədd edildi",
      body: `${offer.listing.title} elanı üzrə təklifiniz ${status === "ACCEPTED" ? "qəbul edildi" : "rədd edildi"}.`,
      link: `/elan/${offer.listing.slug}`,
    });
    res.json({ message: "Təklif yeniləndi", offer: { ...updated, amount: Number(updated.amount) } });
  }),
);
