import type { CustomerType } from "../../generated/prisma/enums.js";

export type SafeGuestSession = {
  id: string;
  orderType: CustomerType;
  tableId: string | null;
  tableNumber: string | null;
  customerId: string | null;
  expiresAt: Date;
  lastActivityAt: Date;
  closedAt: Date | null;
  isActive: boolean;
  outstandingBalance?: string;
  orderCount?: number;
};

export type GuestSessionContext = {
  databaseId: bigint;
  id: string;
  orderType: CustomerType;
  restaurantTableDatabaseId: bigint | null;
  customerDatabaseId: bigint | null;
  expiresAt: Date;
  closedAt: Date | null;
};
