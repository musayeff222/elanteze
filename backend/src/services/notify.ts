import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getIo } from "../lib/socketHub";

export async function notify(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });
  getIo()?.to(`user:${input.userId}`).emit("notification:new", notification);
  return notification;
}

export async function audit(input: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId || null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || null,
      meta: input.meta,
    },
  });
}
