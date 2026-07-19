import type { CustomerType } from "./enums";

export type SafeGuestSession = {
  id: string;
  orderType: CustomerType;
  tableId: string | null;
  tableNumber: string | null;
  customerId: string | null;
  expiresAt: string;
  lastActivityAt: string;
  closedAt: string | null;
  isActive: boolean;
  outstandingBalance?: string;
  orderCount?: number;
};

export type ResolvedTable = {
  id: string;
  tableNumber: string;
  name: string | null;
  capacity: number;
};
