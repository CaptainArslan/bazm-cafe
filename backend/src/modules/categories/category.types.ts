export type SafeCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
};
