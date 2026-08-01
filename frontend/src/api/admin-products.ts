import { endpoints } from "./endpoints";
import { authHttp } from "./http";
import type { SafeProduct } from "../types/product";

export type CreateProductInput = {
  categoryId: string;
  name: string;
  description?: string;
  imagePath?: string;
  price: number;
  preparationMinutes?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  trackStock?: boolean;
  isAvailable?: boolean;
  displayOrder?: number;
};
export type UpdateProductInput = Omit<Partial<CreateProductInput>, "stockQuantity" | "isAvailable">;

export function listAdminProducts() {
  return authHttp.get<{ products: SafeProduct[] }>(endpoints.products.list);
}

export function getAdminProduct(productId: string) {
  return authHttp.get<{ product: SafeProduct }>(endpoints.products.detail(productId));
}

export function createProduct(input: CreateProductInput) {
  return authHttp.post<{ product: SafeProduct }>(endpoints.products.list, input);
}

export function updateProduct(productId: string, input: UpdateProductInput) {
  return authHttp.patch<{ product: SafeProduct }>(endpoints.products.detail(productId), input);
}

export function updateProductStatus(productId: string, isAvailable: boolean) {
  return authHttp.patch<{ product: SafeProduct }>(endpoints.products.status(productId), { isAvailable });
}

export function deleteProduct(productId: string) {
  return authHttp.delete<Record<string, never>>(endpoints.products.detail(productId));
}

export function adjustProductStock(productId: string, input: { quantityDelta: number; reason: string }) {
  return authHttp.patch<{ product: SafeProduct }>(endpoints.products.stock(productId), input);
}
