import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { config } from "../config";
import { HttpError } from "./errors";

const IMAGE_FORMATS = new Set(["jpeg", "png", "webp"]);

export async function ensureUploadDir() {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

export function isManagedUpload(url: string, kind: "image" | "video"): boolean {
  if (kind === "image") return /^\/uploads\/[a-f0-9]{32}(_thumb)?\.webp$/.test(url);
  return /^\/uploads\/[a-f0-9]{32}\.(mp4|webm)$/.test(url);
}

export async function saveImage(buffer: Buffer): Promise<{ url: string; thumbnailUrl: string }> {
  if (buffer.length > config.maxImageBytes) {
    throw new HttpError(400, "Şəkil 8 MB-dan böyük ola bilməz");
  }
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 20_000_000 }).metadata();
  } catch {
    throw new HttpError(400, "Şəkil faylı oxunmadı");
  }
  if (!meta.format || !IMAGE_FORMATS.has(meta.format)) {
    throw new HttpError(400, "Yalnız JPG, PNG və WEBP şəkillər qəbul edilir");
  }

  await ensureUploadDir();
  const id = crypto.randomBytes(16).toString("hex");
  const filename = `${id}.webp`;
  const thumbName = `${id}_thumb.webp`;

  await sharp(buffer, { limitInputPixels: 20_000_000 })
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(config.uploadDir, filename));

  await sharp(buffer, { limitInputPixels: 20_000_000 })
    .rotate()
    .resize(480, 480, { fit: "cover" })
    .webp({ quality: 72 })
    .toFile(path.join(config.uploadDir, thumbName));

  return { url: `/uploads/${filename}`, thumbnailUrl: `/uploads/${thumbName}` };
}

export async function saveVideo(buffer: Buffer, mime: string): Promise<{ url: string }> {
  if (buffer.length > config.maxVideoBytes) {
    throw new HttpError(400, "Video 30 MB-dan böyük ola bilməz");
  }
  const ext = detectVideo(buffer, mime);
  if (!ext) throw new HttpError(400, "Yalnız MP4 və WEBM videolar qəbul edilir");
  await ensureUploadDir();
  const id = crypto.randomBytes(16).toString("hex");
  const filename = `${id}.${ext}`;
  await fs.writeFile(path.join(config.uploadDir, filename), buffer);
  return { url: `/uploads/${filename}` };
}

function detectVideo(buffer: Buffer, mime: string): "mp4" | "webm" | null {
  const mimeOk = mime === "video/mp4" || mime === "video/webm" || mime === "video/quicktime";
  if (!mimeOk && mime !== "application/octet-stream") return null;
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") return "mp4";
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm";
  }
  return null;
}

export async function placeholderImage(color: string): Promise<{ url: string; thumbnailUrl: string }> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <rect width="100%" height="100%" fill="${color}"/>
    <circle cx="980" cy="140" r="90" fill="rgba(255,255,255,.18)"/>
    <rect x="80" y="640" width="420" height="28" rx="14" fill="rgba(255,255,255,.28)"/>
    <rect x="80" y="690" width="260" height="18" rx="9" fill="rgba(255,255,255,.18)"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return saveImage(png);
}
