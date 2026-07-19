import "dotenv/config";

import { randomUUID } from "node:crypto";

import { prisma } from "../src/config/database.js";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../src/modules/auth/token.service.js";
import { generateTableQrImage } from "../src/utils/qr-code.js";
import { ensureUploadDirectories } from "../src/utils/storage.js";

async function main() {
  await ensureUploadDirectories();

  const tableNumber = `T-${Date.now().toString().slice(-4)}`;
  const uuid = randomUUID();
  const rawToken = generateOpaqueToken();
  const qrImagePath = await generateTableQrImage({
    tableUuid: uuid,
    qrVersion: 1,
    rawToken,
  });

  const table = await prisma.restaurantTable.create({
    data: {
      uuid,
      tableNumber,
      name: `Postman ${tableNumber}`,
      capacity: 4,
      qrTokenHash: hashOpaqueToken(rawToken),
      qrVersion: 1,
      qrImagePath,
      qrGeneratedAt: new Date(),
    },
    select: {
      uuid: true,
      tableNumber: true,
      qrImagePath: true,
    },
  });

  console.log("");
  console.log("Postman table created. Set these collection variables:");
  console.log(`  tableId     = ${table.uuid}`);
  console.log(`  tableNumber = ${table.tableNumber}`);
  console.log(`  tableToken  = ${rawToken}`);
  console.log(`  qrImagePath = ${table.qrImagePath}`);
  console.log("");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
