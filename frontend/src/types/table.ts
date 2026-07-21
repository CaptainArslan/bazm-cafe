export type TableOperationalStatus = "AVAILABLE" | "OUT_OF_SERVICE";
export type TableDerivedStatus = "AVAILABLE" | "OCCUPIED" | "OUT_OF_SERVICE";

export type SafeTable = {
  id: string;
  tableNumber: string;
  name: string | null;
  capacity: number;
  operationalStatus: TableOperationalStatus;
  status: TableDerivedStatus;
  isActive: boolean;
  qrVersion: number;
  qrImagePath: string | null;
  qrImageUrl: string | null;
  qrGeneratedAt: string;
  qrRegeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTableInput = { tableNumber: string; name?: string; capacity?: number };
export type UpdateTableInput = { tableNumber?: string; name?: string; capacity?: number };
