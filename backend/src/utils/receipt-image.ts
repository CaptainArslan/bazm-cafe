import path from "node:path";
import sharp from "sharp";

import { env } from "../config/environment.js";
import {
  RECEIPT_UPLOADS_DIR,
  ensureUploadDirectories,
  toPublicPath,
} from "./storage.js";

export type ReceiptImageInput = {
  orderUuid: string;
  orderNumber: string;
  orderType: string;
  tableNumber?: string | null;
  customerName?: string | null;
  status: string;
  paymentStatus: string;
  createdAt: Date;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function generateReceiptImage(
  input: ReceiptImageInput,
): Promise<string> {
  await ensureUploadDirectories();

  const itemLines = input.items
    .map((item, index) => {
      const y = 220 + index * 36;
      return `
        <text x="32" y="${y}" font-size="16" fill="#1f2937">${escapeXml(item.name)}</text>
        <text x="32" y="${y + 18}" font-size="13" fill="#6b7280">${item.quantity} x Rs. ${escapeXml(item.unitPrice)}</text>
        <text x="340" y="${y}" font-size="16" fill="#1f2937" text-anchor="end">Rs. ${escapeXml(item.lineTotal)}</text>
      `;
    })
    .join("");

  const height = Math.max(520, 280 + input.items.length * 36 + 180);

  const svg = `
    <svg width="400" height="${height}" viewBox="0 0 400 ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="${height}" fill="#ffffff"/>
      <text x="200" y="48" font-size="24" font-weight="700" text-anchor="middle" fill="#111827">${escapeXml(env.APP_NAME)}</text>
      <text x="200" y="76" font-size="14" text-anchor="middle" fill="#6b7280">Order Receipt</text>
      <line x1="32" y1="96" x2="368" y2="96" stroke="#e5e7eb"/>
      <text x="32" y="128" font-size="14" fill="#374151">Order: ${escapeXml(input.orderNumber)}</text>
      <text x="32" y="150" font-size="14" fill="#374151">Date: ${escapeXml(input.createdAt.toISOString())}</text>
      <text x="32" y="172" font-size="14" fill="#374151">Type: ${escapeXml(input.orderType)}</text>
      ${
        input.tableNumber
          ? `<text x="32" y="194" font-size="14" fill="#374151">Table: ${escapeXml(input.tableNumber)}</text>`
          : input.customerName
            ? `<text x="32" y="194" font-size="14" fill="#374151">Customer: ${escapeXml(input.customerName)}</text>`
            : ""
      }
      <line x1="32" y1="208" x2="368" y2="208" stroke="#e5e7eb"/>
      ${itemLines}
      <line x1="32" y1="${height - 140}" x2="368" y2="${height - 140}" stroke="#e5e7eb"/>
      <text x="32" y="${height - 110}" font-size="16" font-weight="700" fill="#111827">Total</text>
      <text x="368" y="${height - 110}" font-size="16" font-weight="700" text-anchor="end" fill="#111827">Rs. ${escapeXml(input.totalAmount)}</text>
      <text x="32" y="${height - 84}" font-size="14" fill="#374151">Paid</text>
      <text x="368" y="${height - 84}" font-size="14" text-anchor="end" fill="#374151">Rs. ${escapeXml(input.paidAmount)}</text>
      <text x="32" y="${height - 60}" font-size="14" fill="#374151">Remaining</text>
      <text x="368" y="${height - 60}" font-size="14" text-anchor="end" fill="#374151">Rs. ${escapeXml(input.remainingAmount)}</text>
      <text x="32" y="${height - 30}" font-size="13" fill="#6b7280">${escapeXml(input.status)} / ${escapeXml(input.paymentStatus)}</text>
    </svg>
  `;

  const absolutePath = path.join(RECEIPT_UPLOADS_DIR, `${input.orderUuid}.png`);

  await sharp(Buffer.from(svg)).png().toFile(absolutePath);

  return toPublicPath(absolutePath);
}
