import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { env } from "../../config/environment.js";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import {
  assertSafeMediaPublicPath,
  deletePublicFile,
  MEDIA_PUBLIC_PREFIX,
  MEDIA_UPLOADS_DIR,
  mediaFileExists,
} from "../../utils/storage.js";
import { MEDIA_MESSAGES, type MediaFolder } from "./media.constants.js";
import type { SafeMedia } from "./media.types.js";
import { toStoredMedia } from "./media.upload.js";

const mimeTypeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function mimeTypeForExtension(extension: string): string {
  return mimeTypeByExtension[extension.toLowerCase()] ?? "application/octet-stream";
}

export function toSafeMedia(input: {
  path: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}): SafeMedia {
  return {
    path: input.path,
    url: `${env.APP_URL}${input.path}`,
    folder: input.folder,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    originalName: input.originalName,
  };
}

export function storeUploadedMedia(
  file: Express.Multer.File | undefined,
  folder: MediaFolder,
): SafeMedia {
  if (file === undefined) {
    throw new AppError(
      MEDIA_MESSAGES.FILE_REQUIRED,
      HTTP_STATUS.BAD_REQUEST,
      "MEDIA_FILE_REQUIRED",
    );
  }

  return toSafeMedia(toStoredMedia(file, folder));
}

export async function deleteMediaByPath(publicPath: string): Promise<void> {
  let safePath: string;

  try {
    safePath = assertSafeMediaPublicPath(publicPath);
  } catch {
    throw new AppError(
      MEDIA_MESSAGES.INVALID_PATH,
      HTTP_STATUS.BAD_REQUEST,
      "INVALID_MEDIA_PATH",
    );
  }

  const exists = await mediaFileExists(safePath);

  if (!exists) {
    throw new AppError(
      MEDIA_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "MEDIA_NOT_FOUND",
    );
  }

  await deletePublicFile(safePath);
}

export async function listMediaInFolder(folder: MediaFolder): Promise<SafeMedia[]> {
  const folderDir = path.join(MEDIA_UPLOADS_DIR, folder);

  let entries: string[];

  try {
    entries = await readdir(folderDir, { withFileTypes: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const media: SafeMedia[] = [];

  for (const filename of entries) {
    const filePath = path.join(folderDir, filename);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) continue;

    media.push(
      toSafeMedia({
        path: `${MEDIA_PUBLIC_PREFIX}/${folder}/${filename}`,
        folder,
        mimeType: mimeTypeForExtension(path.extname(filename)),
        sizeBytes: fileStat.size,
        originalName: filename,
      }),
    );
  }

  return media;
}
