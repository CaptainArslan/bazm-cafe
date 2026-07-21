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
  return authHttp.get<{ products: SafeProduct[] }>("/products");
}

export function getAdminProduct(productId: string) {
  return authHttp.get<{ product: SafeProduct }>(`/products/${productId}`);
}

export function createProduct(input: CreateProductInput) {
  return authHttp.post<{ product: SafeProduct }>("/products", input);
}

export function updateProduct(productId: string, input: UpdateProductInput) {
  return authHttp.patch<{ product: SafeProduct }>(`/products/${productId}`, input);
}

export function updateProductStatus(productId: string, isAvailable: boolean) {
  return authHttp.patch<{ product: SafeProduct }>(`/products/${productId}/status`, { isAvailable });
}

export function deleteProduct(productId: string) {
  return authHttp.delete<Record<string, never>>(`/products/${productId}`);
}
