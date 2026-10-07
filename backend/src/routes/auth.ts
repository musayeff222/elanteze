import { Router } from "express";
import { config } from "../config";
import { phoneCodeTemplate, resetPasswordTemplate, verifyEmailTemplate } from "../emails/templates";
import { setAuthCookies, clearAuthCookies } from "../lib/cookies";
import { HttpError } from "../lib/errors";
import { sendMail } from "../lib/mailer";
import { hashPassword, phoneCode, randomToken, sha256, verifyPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import { normalizePhone, sanitizeText } from "../lib/text";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/tokens";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { forgotSchema, loginSchema, passwordChangeSchema, profileSchema, registerSchema, resetSchema, verifyPhoneSchema } from "../schemas";
import { isOnline } from "../lib/presence";

export const authRouter = Router();

function sessionUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  avatarUrl: string | null;
  bio: string | null;
  cityId: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  city?: { id: string; name: string; slug: string } | null;
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    cityId: user.cityId,
    city: user.city ?? null,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    createdAt: user.createdAt,
    isOnline: isOnline(user.id),
  };
}

async function issueSession(userId: string, role: "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN", res: import("express").Response) {
  const access = signAccessToken({ sub: userId, role });
  const refresh = signRefreshToken(userId);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(refresh),
      expiresAt: new Date(Date.now() + config.refreshTtlSec * 1000),
    },
  });
  setAuthCookies(res, access, refresh);
}

authRouter.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
      password: string;
    };
    let phone: string;
    try {
      phone = normalizePhone(body.phone);
    } catch {
      throw new HttpError(400, "Telefon nömrəsi düzgün deyil");
    }
    const email = body.email.toLowerCase();
    const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (exists) throw new HttpError(409, "Bu e-poçt və ya telefon artıq qeydiyyatdadır");

    const emailToken = randomToken();
    const code = phoneCode();
    const user = await prisma.user.create({
      data: {
        firstName: sanitizeText(body.firstName),
        lastName: sanitizeText(body.lastName),
        phone,
        email,
        passwordHash: await hashPassword(body.password),
        emailVerifyToken: sha256(emailToken),
        phoneVerifyHash: sha256(code),
        phoneVerifyExp: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const verifyLink = `${config.frontendUrl}/email-tesdiq?token=${emailToken}`;
    await sendMail(user.email, verifyEmailTemplate(verifyLink));
    await sendMail(user.email, phoneCodeTemplate(code));

    await issueSession(user.id, user.role, res);
    res.status(201).json({
      message: "Qeydiyyat tamamlandı. E-poçt və telefon təsdiqi göndərildi.",
      user: sessionUser(user),
      ...(config.exposeDevTokens ? { devEmailToken: emailToken, devPhoneCode: code, devVerifyLink: verifyLink } : {}),
    });
  }),
);

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { city: true } });
    if (!user || user.deletedAt) throw new HttpError(401, "E-poçt və ya şifrə yanlışdır");
    if (user.isBlocked) throw new HttpError(403, "Hesabınız bloklanıb");
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new HttpError(401, "E-poçt və ya şifrə yanlışdır");
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    await issueSession(user.id, user.role, res);
    res.json({ message: "Giriş uğurludur", user: sessionUser(user) });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const refresh = req.cookies?.alver_refresh as string | undefined;
    if (refresh) {
      await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refresh) }, data: { revoked: true } });
    }
    clearAuthCookies(res);
    res.json({ message: "Çıxış edildi" });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refresh = req.cookies?.alver_refresh as string | undefined;
    if (!refresh) throw new HttpError(401, "Sessiya tapılmadı");
    let userId = "";
    try {
      userId = verifyRefreshToken(refresh).sub;
    } catch {
      clearAuthCookies(res);
      throw new HttpError(401, "Sessiya etibarsızdır");
    }
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refresh) } });
    if (!stored || stored.userId !== userId) {
      clearAuthCookies(res);
      throw new HttpError(401, "Sessiya etibarsızdır");
    }
    if (stored.revoked || stored.expiresAt < new Date()) {
      await prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
      clearAuthCookies(res);
      throw new HttpError(401, "Sessiya etibarsızdır");
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isBlocked || user.deletedAt) throw new HttpError(401, "Hesab aktiv deyil");
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    await issueSession(user.id, user.role, res);
    res.json({ message: "Sessiya yeniləndi" });
  }),
);

authRouter.post(
  "/forgot-password",
  validate(forgotSchema),
  asyncHandler(async (req, res) => {
    const email = String(req.body.email).toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    let devResetLink: string | undefined;
    if (user && !user.deletedAt && !user.isBlocked) {
      const token = randomToken();
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: sha256(token), resetTokenExp: new Date(Date.now() + 30 * 60 * 1000) },
      });
      const link = `${config.frontendUrl}/sifre-yenile?token=${token}`;
      await sendMail(user.email, resetPasswordTemplate(link));
      if (config.exposeDevTokens) devResetLink = link;
    }
    res.json({
      message: "Əgər e-poçt ünvanı mövcuddursa, bərpa linki göndərildi.",
      ...(devResetLink ? { devResetLink } : {}),
    });
  }),
);

authRouter.post(
  "/reset-password",
  validate(resetSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as { token: string; password: string };
    const user = await prisma.user.findFirst({
      where: { resetTokenHash: sha256(token), resetTokenExp: { gt: new Date() } },
    });
    if (!user) throw new HttpError(400, "Bərpa linki etibarsızdır və ya vaxtı bitib");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        resetTokenHash: null,
        resetTokenExp: null,
      },
    });
    await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });
    res.json({ message: "Şifrə yeniləndi. İndi daxil ola bilərsiniz." });
  }),
);

authRouter.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || "");
    if (!token) throw new HttpError(400, "Təsdiq tokeni yoxdur");
    const user = await prisma.user.findFirst({ where: { emailVerifyToken: sha256(token) } });
    if (!user) throw new HttpError(400, "Təsdiq linki etibarsızdır");
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, emailVerifyToken: null } });
    res.json({ message: "E-poçt təsdiqləndi" });
  }),
);

authRouter.post(
  "/resend-email",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (user.emailVerified) {
      res.json({ message: "E-poçt artıq təsdiqlənib" });
      return;
    }
    const emailToken = randomToken();
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifyToken: sha256(emailToken) } });
    const verifyLink = `${config.frontendUrl}/email-tesdiq?token=${emailToken}`;
    await sendMail(user.email, verifyEmailTemplate(verifyLink));
    res.json({
      message: "Təsdiq linki göndərildi",
      ...(config.exposeDevTokens ? { devEmailToken: emailToken, devVerifyLink: verifyLink } : {}),
    });
  }),
);

authRouter.post(
  "/verify-phone",
  requireAuth,
  validate(verifyPhoneSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.phoneVerifyHash || !user.phoneVerifyExp || user.phoneVerifyExp < new Date()) {
      throw new HttpError(400, "Təsdiq kodunun vaxtı bitib. Yenidən kod istəyin.");
    }
    if (sha256(req.body.code) !== user.phoneVerifyHash) throw new HttpError(400, "Təsdiq kodu yanlışdır");
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true, phoneVerifyHash: null, phoneVerifyExp: null },
    });
    res.json({ message: "Telefon təsdiqləndi" });
  }),
);

authRouter.post(
  "/resend-phone",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (user.phoneVerified) {
      res.json({ message: "Telefon artıq təsdiqlənib" });
      return;
    }
    const code = phoneCode();
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerifyHash: sha256(code), phoneVerifyExp: new Date(Date.now() + 10 * 60 * 1000) },
    });
    await sendMail(user.email, phoneCodeTemplate(code));
    res.json({
      message: "Təsdiq kodu göndərildi",
      ...(config.exposeDevTokens ? { devPhoneCode: code } : {}),
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      include: { city: { select: { id: true, name: true, slug: true } } },
    });
    res.json({ user: sessionUser(user) });
  }),
);

authRouter.patch(
  "/me",
  requireAuth,
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      firstName?: string;
      lastName?: string;
      bio?: string | null;
      cityId?: string | null;
      avatarUrl?: string | null;
    };
    if (body.cityId) {
      const city = await prisma.city.findUnique({ where: { id: body.cityId } });
      if (!city) throw new HttpError(400, "Şəhər tapılmadı");
    }
    if (body.avatarUrl && !body.avatarUrl.startsWith("/uploads/")) {
      throw new HttpError(400, "Profil şəkli etibarsızdır");
    }
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        firstName: body.firstName ? sanitizeText(body.firstName) : undefined,
        lastName: body.lastName ? sanitizeText(body.lastName) : undefined,
        bio: body.bio === undefined ? undefined : body.bio ? sanitizeText(body.bio) : null,
        cityId: body.cityId === undefined ? undefined : body.cityId,
        avatarUrl: body.avatarUrl === undefined ? undefined : body.avatarUrl,
      },
      include: { city: true },
    });
    res.json({ message: "Profil yeniləndi", user: sessionUser(user) });
  }),
);

authRouter.patch(
  "/password",
  requireAuth,
  validate(passwordChangeSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new HttpError(400, "Cari şifrə yanlışdır");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    res.json({ message: "Şifrə dəyişdirildi" });
  }),
);
