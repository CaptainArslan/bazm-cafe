import type { NextFunction, Request, Response } from "express";
import type { MulterError } from "multer";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { MEDIA_MESSAGES, type MediaFolder } from "./media.constants.js";
import { createMediaUploader } from "./media.upload.js";
import {
  deleteMediaByPath,
  listMediaInFolder,
  storeUploadedMedia,
} from "./media.service.js";
import type {
  DeleteMediaInput,
  ListMediaQuery,
  UploadMediaQuery,
} from "./media.validation.js";

export async function uploadMediaMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = request.query as unknown as UploadMediaQuery;
    const folder = (query.folder ?? "general") as MediaFolder;
    const uploader = await createMediaUploader(folder);

    uploader.single("file")(request, response, (error: unknown) => {
      if (error !== undefined && error !== null) {
        next(mapUploadError(error));
        return;
      }

      next();
    });
  } catch (error) {
    next(error);
  }
}

function mapUploadError(error: unknown): AppError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as MulterError).code === "LIMIT_FILE_SIZE"
  ) {
    return new AppError(
      MEDIA_MESSAGES.TOO_LARGE,
      HTTP_STATUS.BAD_REQUEST,
      "MEDIA_TOO_LARGE",
    );
  }

  if (error instanceof Error && error.message === MEDIA_MESSAGES.INVALID_TYPE) {
    return new AppError(
      MEDIA_MESSAGES.INVALID_TYPE,
      HTTP_STATUS.BAD_REQUEST,
      "MEDIA_INVALID_TYPE",
    );
  }

  if (error instanceof Error) {
    return new AppError(
      error.message || MEDIA_MESSAGES.UPLOAD_FAILED,
      HTTP_STATUS.BAD_REQUEST,
      "MEDIA_UPLOAD_FAILED",
    );
  }

  return new AppError(
    MEDIA_MESSAGES.UPLOAD_FAILED,
    HTTP_STATUS.BAD_REQUEST,
    "MEDIA_UPLOAD_FAILED",
  );
}

export async function upload(request: Request, response: Response) {
  const query = request.query as unknown as UploadMediaQuery;
  const media = storeUploadedMedia(
    request.file,
    (query.folder ?? "general") as MediaFolder,
  );

  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Image uploaded successfully.",
    data: { media },
  });
}

export async function list(request: Request, response: Response) {
  const query = request.query as unknown as ListMediaQuery;
  const media = await listMediaInFolder(query.folder ?? "general");

  return sendSuccess(response, {
    message: "Media fetched successfully.",
    data: { media },
  });
}

export async function remove(request: Request, response: Response) {
  const input = request.body as DeleteMediaInput;
  await deleteMediaByPath(input.path);

  return sendSuccess(response, {
    message: "Image deleted successfully.",
  });
}
