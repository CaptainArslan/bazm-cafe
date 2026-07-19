import { prisma } from "../../config/database.js";

const categorySelect = {
  id: true,
  uuid: true,
  name: true,
  slug: true,
  description: true,
  imagePath: true,
  displayOrder: true,
  isVisible: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function findCategoryByUuid(uuid: string) {
  return prisma.category.findFirst({
    where: { uuid, deletedAt: null },
    select: categorySelect,
  });
}

export function findCategoryBySlug(slug: string) {
  return prisma.category.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, uuid: true },
  });
}

export function listCategories(options?: { visibleOnly?: boolean }) {
  return prisma.category.findMany({
    where: {
      deletedAt: null,
      ...(options?.visibleOnly === true && { isVisible: true }),
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: categorySelect,
  });
}

export function createCategory(data: {
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  displayOrder: number;
  isVisible: boolean;
}) {
  return prisma.category.create({
    data,
    select: categorySelect,
  });
}

export function updateCategory(
  categoryId: bigint,
  data: Partial<{
    name: string;
    slug: string;
    description: string | null;
    imagePath: string | null;
    displayOrder: number;
    isVisible: boolean;
    deletedAt: Date | null;
  }>,
) {
  return prisma.category.update({
    where: { id: categoryId },
    data,
    select: categorySelect,
  });
}

export function countCategoryProducts(categoryId: bigint) {
  return prisma.product.count({
    where: { categoryId, deletedAt: null },
  });
}
