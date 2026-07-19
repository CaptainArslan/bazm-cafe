import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { slugify } from "../../utils/slug.js";
import { CATEGORY_MESSAGES } from "./category.constants.js";
import {
  countCategoryProducts,
  createCategory,
  findCategoryBySlug,
  findCategoryByUuid,
  listCategories,
  updateCategory,
} from "./category.repository.js";
import type { SafeCategory } from "./category.types.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  UpdateCategoryStatusInput,
} from "./category.validation.js";

function toSafeCategory(category: {
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  displayOrder: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SafeCategory {
  return {
    id: category.uuid,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imagePath: category.imagePath,
    displayOrder: category.displayOrder,
    isVisible: category.isVisible,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

async function uniqueSlug(name: string, excludeUuid?: string): Promise<string> {
  const base = slugify(name) || "category";
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await findCategoryBySlug(candidate);

    if (existing === null || existing.uuid === excludeUuid) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function listCategoryRecords(visibleOnly = false) {
  const categories = await listCategories({ visibleOnly });
  return categories.map(toSafeCategory);
}

export async function getCategoryRecord(categoryId: string) {
  const category = await findCategoryByUuid(categoryId);

  if (category === null) {
    throw new AppError(
      CATEGORY_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "CATEGORY_NOT_FOUND",
    );
  }

  return toSafeCategory(category);
}

export async function createCategoryRecord(input: CreateCategoryInput) {
  const slug = await uniqueSlug(input.name);

  const category = await createCategory({
    name: input.name,
    slug,
    description: input.description ?? null,
    imagePath: input.imagePath ?? null,
    displayOrder: input.displayOrder,
    isVisible: input.isVisible,
  });

  return toSafeCategory(category);
}

export async function updateCategoryRecord(
  categoryId: string,
  input: UpdateCategoryInput,
) {
  const category = await findCategoryByUuid(categoryId);

  if (category === null) {
    throw new AppError(
      CATEGORY_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "CATEGORY_NOT_FOUND",
    );
  }

  const slug =
    input.name !== undefined
      ? await uniqueSlug(input.name, category.uuid)
      : undefined;

  const updated = await updateCategory(category.id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(slug !== undefined && { slug }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.imagePath !== undefined && { imagePath: input.imagePath }),
    ...(input.displayOrder !== undefined && {
      displayOrder: input.displayOrder,
    }),
  });

  return toSafeCategory(updated);
}

export async function updateCategoryStatusRecord(
  categoryId: string,
  input: UpdateCategoryStatusInput,
) {
  const category = await findCategoryByUuid(categoryId);

  if (category === null) {
    throw new AppError(
      CATEGORY_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "CATEGORY_NOT_FOUND",
    );
  }

  const updated = await updateCategory(category.id, {
    isVisible: input.isVisible,
  });

  return toSafeCategory(updated);
}

export async function deleteCategoryRecord(categoryId: string) {
  const category = await findCategoryByUuid(categoryId);

  if (category === null) {
    throw new AppError(
      CATEGORY_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "CATEGORY_NOT_FOUND",
    );
  }

  const productCount = await countCategoryProducts(category.id);

  if (productCount > 0) {
    throw new AppError(
      CATEGORY_MESSAGES.HAS_PRODUCTS,
      HTTP_STATUS.CONFLICT,
      "CATEGORY_HAS_PRODUCTS",
    );
  }

  await updateCategory(category.id, {
    deletedAt: new Date(),
    isVisible: false,
  });
}
