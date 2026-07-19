import { access, mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const PUBLIC_ROOT = path.resolve("public");
export const UPLOADS_ROOT = path.join(PUBLIC_ROOT, "uploads");
export const QR_UPLOADS_DIR = path.join(UPLOADS_ROOT, "qr");
export const RECEIPT_UPLOADS_DIR = path.join(UPLOADS_ROOT, "receipts");
export const MEDIA_UPLOADS_DIR = path.join(UPLOADS_ROOT, "media");

export const MEDIA_PUBLIC_PREFIX = "/uploads/media";

export async function ensureUploadDirectories(): Promise<void> {
  await mkdir(QR_UPLOADS_DIR, { recursive: true });
  await mkdir(RECEIPT_UPLOADS_DIR, { recursive: true });
  await mkdir(MEDIA_UPLOADS_DIR, { recursive: true });
}

export function toPublicPath(absolutePath: string): string {
  const relative = path.relative(PUBLIC_ROOT, absolutePath).replace(/\\/g, "/");
  return `/${relative}`;
}

export function resolvePublicPath(publicPath: string): string {
  const normalized = publicPath.replace(/^\/+/, "");
  return path.join(PUBLIC_ROOT, normalized);
}

/** Ensures a public path stays inside /uploads/media and cannot path-traverse. */
export function assertSafeMediaPublicPath(publicPath: string): string {
  const trimmed = publicPath.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  if (!withLeadingSlash.startsWith(`${MEDIA_PUBLIC_PREFIX}/`)) {
    throw new Error("INVALID_MEDIA_PATH");
  }

  const absolute = path.resolve(resolvePublicPath(withLeadingSlash));
  const mediaRoot = path.resolve(MEDIA_UPLOADS_DIR);

  if (absolute !== mediaRoot && !absolute.startsWith(mediaRoot + path.sep)) {
    throw new Error("INVALID_MEDIA_PATH");
  }

  return withLeadingSlash;
}

export async function mediaFileExists(publicPath: string): Promise<boolean> {
  try {
    await access(resolvePublicPath(publicPath));
    return true;
  } catch {
    return false;
  }
}

export async function deletePublicFile(
  publicPath: string | null | undefined,
): Promise<void> {
  if (
    publicPath === null ||
    publicPath === undefined ||
    publicPath.length === 0
  ) {
    return;
  }

  try {
    await unlink(resolvePublicPath(publicPath));
  } catch {
    // File may already be missing; ignore.
  }
}
