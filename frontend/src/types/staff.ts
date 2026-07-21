export type SafeStaff = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  role: "STAFF";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateStaffInput = { name: string; email: string; phone?: string; password: string; imagePath?: string };
export type UpdateStaffInput = { name?: string; email?: string; phone?: string | null; imagePath?: string | null };
