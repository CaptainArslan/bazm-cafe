import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { CAFE_SETTINGS_ID } from "./settings.constants.js";

const settingsSelect = {
  id: true,
  taxRatePercent: true,
  serviceChargePercent: true,
  updatedAt: true,
  createdAt: true,
} as const;

export function findCafeSettings() {
  return prisma.cafeSettings.findUnique({
    where: { id: CAFE_SETTINGS_ID },
    select: settingsSelect,
  });
}

export function ensureCafeSettings() {
  return prisma.cafeSettings.upsert({
    where: { id: CAFE_SETTINGS_ID },
    create: {
      id: CAFE_SETTINGS_ID,
      taxRatePercent: 0,
      serviceChargePercent: 0,
    },
    update: {},
    select: settingsSelect,
  });
}

export function updateCafeSettings(data: {
  taxRatePercent?: Prisma.Decimal | number;
  serviceChargePercent?: Prisma.Decimal | number;
}) {
  return prisma.cafeSettings.update({
    where: { id: CAFE_SETTINGS_ID },
    data: {
      ...(data.taxRatePercent !== undefined && {
        taxRatePercent: data.taxRatePercent,
      }),
      ...(data.serviceChargePercent !== undefined && {
        serviceChargePercent: data.serviceChargePercent,
      }),
    },
    select: settingsSelect,
  });
}
