export type SafeStaff = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  role: "STAFF";
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
