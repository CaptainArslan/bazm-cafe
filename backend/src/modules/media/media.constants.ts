export const MEDIA_MESSAGES = {
  FILE_REQUIRED: "An image file is required (field name: file).",
  INVALID_TYPE: "Only JPEG, PNG, WebP, and GIF images are allowed.",
  TOO_LARGE: "Image must be 5MB or smaller.",
  INVALID_PATH: "Media path must be under /uploads/media/.",
  NOT_FOUND: "Media file not found.",
  UPLOAD_FAILED: "Image upload failed.",
} as const;

export const MEDIA_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export const MEDIA_FOLDERS = [
  "general",
  "categories",
  "products",
  "staff",
  "customers",
] as const;

export type MediaFolder = (typeof MEDIA_FOLDERS)[number];
