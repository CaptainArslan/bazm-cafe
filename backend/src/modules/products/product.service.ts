import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma } from "../../generated/prisma/client.js";
import { money, toMoneyString } from "../../utils/money.js";
import { slugify } from "../../utils/slug.js";
import { findCategoryByUuid } from "../categories/category.repository.js";
import { PRODUCT_MESSAGES } from "./product.constants.js";
import {
  adjustProductStock,
  countProductOrderItems,
  createProduct,
  findProductBySlug,
  findProductByUuid,
  listMenuProducts,
  listProducts,
  updateProduct,
} from "./product.repository.js";
import type { SafeProduct } from "./product.types.js";
import type {
  AdjustProductStockInput,
  CreateProductInput,
  UpdateProductInput,
  UpdateProductStatusInput,
} from "./product.validation.js";

function toSafeProduct(product: {
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  price: Prisma.Decimal;
  preparationMinutes: number;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  trackStock: boolean;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  category: { uuid: string; name: string };
}): SafeProduct {
  return {
    id: product.uuid,
    categoryId: product.category.uuid,
    categoryName: product.category.name,
    name: product.name,
    slug: product.slug,
    description: product.description,
    imagePath: product.imagePath,
    price: toMoneyString(product.price),
    preparationMinutes: product.preparationMinutes,
    stockQuantity: product.stockQuantity,
    reservedQuantity: product.reservedQuantity,
    availableQuantity: product.stockQuantity - product.reservedQuantity,
    lowStockThreshold: product.lowStockThreshold,
    trackStock: product.trackStock,
    isAvailable: product.isAvailable,
    displayOrder: product.displayOrder,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function uniqueProductSlug(
  name: string,
  excludeUuid?: string,
): Promise<string> {
  const base = slugify(name) || "product";
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await findProductBySlug(candidate);

    if (existing === null || existing.uuid === excludeUuid) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function listProductRecords() {
  return (await listProducts()).map(toSafeProduct);
}

export async function listGuestMenuRecords() {
  return (await listMenuProducts())
    .filter((product) => {
      const available = product.stockQuantity - product.reservedQuantity;
      return !product.trackStock || available > 0;
    })
    .map(toSafeProduct);
}

export async function getProductRecord(productId: string) {
  const product = await findProductByUuid(productId);

  if (product === null) {
    throw new AppError(
      PRODUCT_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "PRODUCT_NOT_FOUND",
    );
  }

  return toSafeProduct(product);
}

export async function createProductRecord(input: CreateProductInput) {
  const category = await findCategoryByUuid(input.categoryId);

  if (category === null) {
    throw new AppError(
      PRODUCT_MESSAGES.CATEGORY_NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "CATEGORY_NOT_FOUND",
    );
  }

  if (!category.isVisible) {
    throw new AppError(
      PRODUCT_MESSAGES.CATEGORY_INACTIVE,
      HTTP_STATUS.CONFLICT,
      "CATEGORY_INACTIVE",
    );
  }

  const slug = await uniqueProductSlug(input.name);

  const product = await createProduct({
    categoryId: category.id,
    name: input.name,
    slug,
    description: input.description ?? null,
    imagePath: input.imagePath ?? null,
    price: money(input.price),
    preparationMinutes: input.preparationMinutes,
    stockQuantity: input.stockQuantity,
    lowStockThreshold: input.lowStockThreshold,
    trackStock: input.trackStock,
    isAvailable: input.isAvailable,
    displayOrder: input.displayOrder,
  });

  return toSafeProduct(product);
}

export async function updateProductRecord(
  productId: string,
  input: UpdateProductInput,
) {
  const product = await findProductByUuid(productId);

  if (product === null) {
    throw new AppError(
      PRODUCT_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "PRODUCT_NOT_FOUND",
    );
  }

  let categoryId: bigint | undefined;

  if (input.categoryId !== undefined) {
    const category = await findCategoryByUuid(input.categoryId);

    if (category === null) {
      throw new AppError(
        PRODUCT_MESSAGES.CATEGORY_NOT_FOUND,
        HTTP_STATUS.NOT_FOUND,
        "CATEGORY_NOT_FOUND",
      );
    }

    categoryId = category.id;
  }

  const slug =
    input.name !== undefined
      ? await uniqueProductSlug(input.name, product.uuid)
      : undefined;

  const updated = await updateProduct(product.id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(slug !== undefined && { slug }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.imagePath !== undefined && { imagePath: input.imagePath }),
    ...(input.price !== undefined && { price: money(input.price) }),
    ...(input.preparationMinutes !== undefined && {
      preparationMinutes: input.preparationMinutes,
    }),
    ...(input.lowStockThreshold !== undefined && {
      lowStockThreshold: input.lowStockThreshold,
    }),
    ...(input.trackStock !== undefined && { trackStock: input.trackStock }),
    ...(input.displayOrder !== undefined && {
      displayOrder: input.displayOrder,
    }),
    ...(categoryId !== undefined && {
      category: { connect: { id: categoryId } },
    }),
  });

  return toSafeProduct(updated);
}

export async function updateProductStatusRecord(
  productId: string,
  input: UpdateProductStatusInput,
) {
  const product = await findProductByUuid(productId);

  if (product === null) {
    throw new AppError(
      PRODUCT_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "PRODUCT_NOT_FOUND",
    );
  }

  const updated = await updateProduct(product.id, {
    isAvailable: input.isAvailable,
  });

  return toSafeProduct(updated);
}

export async function adjustProductStockRecord(
  productId: string,
  input: AdjustProductStockInput,
  createdByUserId: bigint,
) {
  const product = await findProductByUuid(productId);

  if (product === null) {
    throw new AppError(
      PRODUCT_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "PRODUCT_NOT_FOUND",
    );
  }

  try {
    const updated = await adjustProductStock({
      productId: product.id,
      quantityDelta: input.quantityDelta,
      reason: input.reason,
      createdByUserId,
    });

    return toSafeProduct(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_STOCK") {
      throw new AppError(
        PRODUCT_MESSAGES.INVALID_STOCK,
        HTTP_STATUS.CONFLICT,
        "INVALID_STOCK",
      );
    }

    throw error;
  }
}

export async function deleteProductRecord(productId: string) {
  const product = await findProductByUuid(productId);

  if (product === null) {
    throw new AppError(
      PRODUCT_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "PRODUCT_NOT_FOUND",
    );
  }

  const orderItemCount = await countProductOrderItems(product.id);

  if (orderItemCount > 0) {
    throw new AppError(
      PRODUCT_MESSAGES.HAS_ORDER_ITEMS,
      HTTP_STATUS.CONFLICT,
      "PRODUCT_HAS_ORDER_ITEMS",
    );
  }

  await updateProduct(product.id, {
    deletedAt: new Date(),
    isAvailable: false,
  });
}
