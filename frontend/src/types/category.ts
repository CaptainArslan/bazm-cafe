export type SafeCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryInput = { name: string; description?: string; imagePath?: string; displayOrder?: number };
export type UpdateCategoryInput = { name?: string; description?: string; imagePath?: string; displayOrder?: number };
