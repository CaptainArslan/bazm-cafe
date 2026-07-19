import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { AUTH_MESSAGES } from "../auth/auth.constants.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  adjustProductStockRecord,
  createProductRecord,
  deleteProductRecord,
  getProductRecord,
  listProductRecords,
  updateProductRecord,
  updateProductStatusRecord,
} from "./product.service.js";
import type {
  AdjustProductStockInput,
  CreateProductInput,
  UpdateProductInput,
  UpdateProductStatusInput,
} from "./product.validation.js";

export async function list(_request: Request, response: Response) {
  const products = await listProductRecords();
  return sendSuccess(response, {
    message: "Products retrieved successfully.",
    data: { products },
  });
}

export async function getById(request: Request, response: Response) {
  const { productId } = request.params as { productId: string };
  const product = await getProductRecord(productId);
  return sendSuccess(response, {
    message: "Product retrieved successfully.",
    data: { product },
  });
}

export async function create(request: Request, response: Response) {
  const product = await createProductRecord(
    request.body as CreateProductInput,
  );
  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Product created successfully.",
    data: { product },
  });
}

export async function update(request: Request, response: Response) {
  const { productId } = request.params as { productId: string };
  const product = await updateProductRecord(
    productId,
    request.body as UpdateProductInput,
  );
  return sendSuccess(response, {
    message: "Product updated successfully.",
    data: { product },
  });
}

export async function updateStatus(request: Request, response: Response) {
  const { productId } = request.params as { productId: string };
  const product = await updateProductStatusRecord(
    productId,
    request.body as UpdateProductStatusInput,
  );
  return sendSuccess(response, {
    message: "Product status updated successfully.",
    data: { product },
  });
}

export async function adjustStock(request: Request, response: Response) {
  if (request.user === undefined) {
    throw new AppError(
      AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
      HTTP_STATUS.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { productId } = request.params as { productId: string };
  const product = await adjustProductStockRecord(
    productId,
    request.body as AdjustProductStockInput,
    request.user.databaseId,
  );

  return sendSuccess(response, {
    message: "Product stock adjusted successfully.",
    data: { product },
  });
}

export async function remove(request: Request, response: Response) {
  const { productId } = request.params as { productId: string };
  await deleteProductRecord(productId);
  return sendSuccess(response, {
    message: "Product deleted successfully.",
  });
}
