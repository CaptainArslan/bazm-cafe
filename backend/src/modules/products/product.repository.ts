import { prisma } from "../../config/database.js";
import { StockMovementType } from "../../generated/prisma/enums.js";
import { Prisma } from "../../generated/prisma/client.js";

const productSelect = {
  id: true,
  uuid: true,
  categoryId: true,
  name: true,
  slug: true,
  description: true,
  imagePath: true,
  price: true,
  preparationMinutes: true,
  stockQuantity: true,
  reservedQuantity: true,
  lowStockThreshold: true,
  trackStock: true,
  isAvailable: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      uuid: true,
      name: true,
      isVisible: true,
      deletedAt: true,
    },
  },
} as const;

export function findProductByUuid(uuid: string) {
  return prisma.product.findFirst({
    where: { uuid, deletedAt: null },
    select: productSelect,
  });
}

export function findProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, uuid: true },
  });
}

export function listProducts() {
  return prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: productSelect,
  });
}

export function listMenuProducts() {
  return prisma.product.findMany({
    where: {
      deletedAt: null,
      isAvailable: true,
      category: {
        deletedAt: null,
        isVisible: true,
      },
    },
    orderBy: [
      { category: { displayOrder: "asc" } },
      { displayOrder: "asc" },
      { name: "asc" },
    ],
    select: productSelect,
  });
}

export function createProduct(data: {
  categoryId: bigint;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  price: Prisma.Decimal;
  preparationMinutes: number;
  stockQuantity: number;
  lowStockThreshold: number;
  trackStock: boolean;
  isAvailable: boolean;
  displayOrder: number;
}) {
  return prisma.product.create({
    data: {
      ...data,
      reservedQuantity: 0,
    },
    select: productSelect,
  });
}

export function updateProduct(
  productId: bigint,
  data: Prisma.ProductUpdateInput,
) {
  return prisma.product.update({
    where: { id: productId },
    data,
    select: productSelect,
  });
}

export async function adjustProductStock(options: {
  productId: bigint;
  quantityDelta: number;
  reason: string;
  createdByUserId: bigint;
}) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: options.productId },
    });

    const nextStock = product.stockQuantity + options.quantityDelta;

    if (nextStock < 0 || nextStock < product.reservedQuantity) {
      throw new Error("INVALID_STOCK");
    }

    const updated = await tx.product.update({
      where: { id: options.productId },
      data: { stockQuantity: nextStock },
      select: productSelect,
    });

    await tx.stockMovement.create({
      data: {
        productId: options.productId,
        createdByUserId: options.createdByUserId,
        type:
          options.quantityDelta > 0
            ? StockMovementType.STOCK_ADDED
            : StockMovementType.STOCK_REMOVED,
        quantity: Math.abs(options.quantityDelta),
        stockBefore: product.stockQuantity,
        stockAfter: nextStock,
        reservedBefore: product.reservedQuantity,
        reservedAfter: product.reservedQuantity,
        notes: options.reason,
      },
    });

    return updated;
  });
}

export function countProductOrderItems(productId: bigint) {
  return prisma.orderItem.count({
    where: { productId },
  });
}
