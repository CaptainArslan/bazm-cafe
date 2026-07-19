export type TableApiStatus = "AVAILABLE" | "OCCUPIED" | "OUT_OF_SERVICE";

export type SafeTable = {
  id: string;
  tableNumber: string;
  name: string | null;
  capacity: number;
  operationalStatus: "AVAILABLE" | "OUT_OF_SERVICE";
  status: TableApiStatus;
  isActive: boolean;
  qrVersion: number;
  qrImagePath: string | null;
  qrImageUrl: string | null;
  qrGeneratedAt: Date;
  qrRegeneratedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
