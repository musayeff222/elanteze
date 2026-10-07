import http from "http";
import { Server } from "socket.io";
import { config } from "./config";
import { prisma } from "./lib/prisma";
import { isOnline, markOffline, markOnline } from "./lib/presence";
import { setIo } from "./lib/socketHub";
import { verifyAccessToken } from "./lib/tokens";

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const parts = header.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
}

export function initSocket(server: http.Server) {
  const io = new Server(server, {
    cors: { origin: config.corsOrigins, credentials: true },
  });
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, "alver_access");
      if (!token) {
        next(new Error("Daxil olmaq lazımdır"));
        return;
      }
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isBlocked: true, deletedAt: true } });
      if (!user || user.isBlocked || user.deletedAt) {
        next(new Error("Hesab aktiv deyil"));
        return;
      }
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("Sessiya etibarsızdır"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    markOnline(userId);
    socket.join(`user:${userId}`);
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
    io.emit("presence", { userId, online: true });

    await prisma.message.updateMany({
      where: {
        deliveredAt: null,
        senderId: { not: userId },
        conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      },
      data: { deliveredAt: new Date() },
    });

    socket.on("conversation:join", async (conversationId: string) => {
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation) return;
      if (conversation.buyerId !== userId && conversation.sellerId !== userId) return;
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("typing:start", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("typing", { conversationId, userId, typing: true });
    });

    socket.on("typing:stop", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("typing", { conversationId, userId, typing: false });
    });

    socket.on("disconnect", async () => {
      markOffline(userId);
      await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
      if (!isOnline(userId)) io.emit("presence", { userId, online: false });
    });
  });

  return io;
}
