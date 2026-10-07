import { Router } from "express";
import multer from "multer";
import { config } from "../config";
import { saveImage, saveVideo } from "../lib/media";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageBytes, files: 1 },
});
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxVideoBytes, files: 1 },
});

export const uploadRouter = Router();
uploadRouter.use(requireAuth);

uploadRouter.post(
  "/image",
  imageUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: "Şəkil seçin" });
      return;
    }
    const saved = await saveImage(req.file.buffer);
    res.status(201).json(saved);
  }),
);

uploadRouter.post(
  "/video",
  videoUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: "Video seçin" });
      return;
    }
    const saved = await saveVideo(req.file.buffer, req.file.mimetype);
    res.status(201).json(saved);
  }),
);
