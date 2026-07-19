import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  createCategoryRecord,
  deleteCategoryRecord,
  getCategoryRecord,
  listCategoryRecords,
  updateCategoryRecord,
  updateCategoryStatusRecord,
} from "./category.service.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  UpdateCategoryStatusInput,
} from "./category.validation.js";

export async function list(_request: Request, response: Response) {
  const categories = await listCategoryRecords(false);
  return sendSuccess(response, {
    message: "Categories retrieved successfully.",
    data: { categories },
  });
}

export async function getById(request: Request, response: Response) {
  const { categoryId } = request.params as { categoryId: string };
  const category = await getCategoryRecord(categoryId);
  return sendSuccess(response, {
    message: "Category retrieved successfully.",
    data: { category },
  });
}

export async function create(request: Request, response: Response) {
  const category = await createCategoryRecord(
    request.body as CreateCategoryInput,
  );
  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Category created successfully.",
    data: { category },
  });
}

export async function update(request: Request, response: Response) {
  const { categoryId } = request.params as { categoryId: string };
  const category = await updateCategoryRecord(
    categoryId,
    request.body as UpdateCategoryInput,
  );
  return sendSuccess(response, {
    message: "Category updated successfully.",
    data: { category },
  });
}

export async function updateStatus(request: Request, response: Response) {
  const { categoryId } = request.params as { categoryId: string };
  const category = await updateCategoryStatusRecord(
    categoryId,
    request.body as UpdateCategoryStatusInput,
  );
  return sendSuccess(response, {
    message: "Category status updated successfully.",
    data: { category },
  });
}

export async function remove(request: Request, response: Response) {
  const { categoryId } = request.params as { categoryId: string };
  await deleteCategoryRecord(categoryId);
  return sendSuccess(response, {
    message: "Category deleted successfully.",
  });
}
