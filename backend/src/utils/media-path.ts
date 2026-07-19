import { z } from "zod";

export const MEDIA_PATH_FOLDERS = [
  "general",
  "categories",
  "products",
  "staff",
  "customers",
] as const;

/** Public path returned by POST /api/v1/media (under /uploads/media/...). */
export const mediaImagePathSchema = z
  .string()
  .trim()
  .max(500)
  .regex(
    /^\/uploads\/media\/(general|categories|products|staff|customers)\/[A-Za-z0-9._-]+$/,
    "imagePath must be a path returned by POST /api/v1/media (for example /uploads/media/products/<file>.png).",
  );

/** Optional imagePath for create/update payloads (omit, null, or "" clears/skips). */
export const optionalMediaImagePathSchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return value;
}, mediaImagePathSchema.nullable().optional());
