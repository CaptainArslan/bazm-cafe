import { env } from "../../config/environment.js";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import {
  assertSafeMediaPublicPath,
  deletePublicFile,
  mediaFileExists,
} from "../../utils/storage.js";
import { MEDIA_MESSAGES, type MediaFolder } from "./media.constants.js";
import type { SafeMedia } from "./media.types.js";
import { toStoredMedia } from "./media.upload.js";

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
