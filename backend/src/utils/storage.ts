import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const PUBLIC_ROOT = path.resolve("public");
export const UPLOADS_ROOT = path.join(PUBLIC_ROOT, "uploads");
export const QR_UPLOADS_DIR = path.join(UPLOADS_ROOT, "qr");
export const RECEIPT_UPLOADS_DIR = path.join(UPLOADS_ROOT, "receipts");

export async function ensureUploadDirectories(): Promise<void> {
  await mkdir(QR_UPLOADS_DIR, { recursive: true });
  await mkdir(RECEIPT_UPLOADS_DIR, { recursive: true });
}

export function toPublicPath(absolutePath: string): string {
  const relative = path.relative(PUBLIC_ROOT, absolutePath).replace(/\\/g, "/");
  return `/${relative}`;
}

export function resolvePublicPath(publicPath: string): string {
  const normalized = publicPath.replace(/^\/+/, "");
  return path.join(PUBLIC_ROOT, normalized);
}

export async function deletePublicFile(
  publicPath: string | null | undefined,
): Promise<void> {
  if (publicPath === null || publicPath === undefined || publicPath.length === 0) {
    return;
  }

  try {
    await unlink(resolvePublicPath(publicPath));
  } catch {
    // File may already be missing; ignore.
  }
}
