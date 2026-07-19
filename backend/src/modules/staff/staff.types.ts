export type SafeStaff = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "STAFF";
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
