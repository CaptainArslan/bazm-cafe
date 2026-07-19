import { z } from "zod";

import { MEDIA_FOLDERS } from "./media.constants.js";

export const uploadMediaQuerySchema = z
  .object({
    folder: z.enum(MEDIA_FOLDERS).default("general"),
  })
  .strict();

export const deleteMediaSchema = z
  .object({
    path: z
      .string()
      .trim()
      .min(1, "path is required.")
      .max(500, "path is too long."),
  })
  .strict();

export type UploadMediaQuery = z.infer<typeof uploadMediaQuerySchema>;
export type DeleteMediaInput = z.infer<typeof deleteMediaSchema>;
