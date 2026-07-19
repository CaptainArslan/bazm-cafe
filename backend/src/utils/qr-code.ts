import path from "node:path";
import QRCode from "qrcode";

import { env } from "../config/environment.js";
import {
  QR_UPLOADS_DIR,
  ensureUploadDirectories,
  toPublicPath,
} from "./storage.js";

export function buildTableQrPayload(rawToken: string): string {
  const url = new URL("/dine-in", env.FRONTEND_URL);
  url.searchParams.set("t", rawToken);
  return url.toString();
}

export async function generateTableQrImage(options: {
  tableUuid: string;
  qrVersion: number;
  rawToken: string;
}): Promise<string> {
  await ensureUploadDirectories();

  const fileName = `${options.tableUuid}-v${options.qrVersion}.png`;
  const absolutePath = path.join(QR_UPLOADS_DIR, fileName);

  await QRCode.toFile(absolutePath, buildTableQrPayload(options.rawToken), {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return toPublicPath(absolutePath);
}
