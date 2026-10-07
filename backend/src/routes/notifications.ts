import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

notificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = items.filter((item) => !item.isRead).length;
    res.json({ items, unread });
  }),
);

notificationRouter.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const note = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!note) {
      res.status(404).json({ message: "Bildiriş tapılmadı" });
      return;
    }
    const updated = await prisma.notification.update({ where: { id: note.id }, data: { isRead: true } });
    res.json({ notification: updated });
  }),
);

notificationRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ message: "Bütün bildirişlər oxundu" });
  }),
);
