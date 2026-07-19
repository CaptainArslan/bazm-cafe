import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import multer from "multer";

import {
  MEDIA_UPLOADS_DIR,
  ensureUploadDirectories,
  toPublicPath,
} from "../../utils/storage.js";
import {
  MEDIA_ALLOWED_MIME_TYPES,
  MEDIA_MAX_BYTES,
  MEDIA_MESSAGES,
  type MediaFolder,
} from "./media.constants.js";

const extensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function isAllowedMime(mime: string): boolean {
  return (MEDIA_ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export async function createMediaUploader(folder: MediaFolder) {
  await ensureUploadDirectories();
  const destination = path.join(MEDIA_UPLOADS_DIR, folder);
  await mkdir(destination, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, destination);
    },
    filename: (_request, file, callback) => {
      const fromMime = extensionByMime[file.mimetype];
      const fromName = path.extname(file.originalname).toLowerCase();
      const extension = fromMime ?? (fromName.length > 0 ? fromName : ".bin");
      callback(null, `${randomUUID()}${extension}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: MEDIA_MAX_BYTES,
      files: 1,
    },
    fileFilter: (_request, file, callback) => {
      if (!isAllowedMime(file.mimetype)) {
        callback(new Error(MEDIA_MESSAGES.INVALID_TYPE));
        return;
      }

      callback(null, true);
    },
  });
}

export function toStoredMedia(file: Express.Multer.File, folder: MediaFolder) {
  return {
    path: toPublicPath(file.path),
    folder,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    originalName: file.originalname,
  };
}
