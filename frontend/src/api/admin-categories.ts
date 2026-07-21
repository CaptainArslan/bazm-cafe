import { authHttp } from "./http";
import type { CreateCategoryInput, SafeCategory, UpdateCategoryInput } from "../types/category";

export function listCategories() {
  return authHttp.get<{ categories: SafeCategory[] }>("/categories");
}

export function getCategory(categoryId: string) {
  return authHttp.get<{ category: SafeCategory }>(`/categories/${categoryId}`);
}

export function createCategory(input: CreateCategoryInput) {
  return authHttp.post<{ category: SafeCategory }>("/categories", input);
}

export function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  return authHttp.patch<{ category: SafeCategory }>(`/categories/${categoryId}`, input);
}

export function updateCategoryStatus(categoryId: string, isVisible: boolean) {
  return authHttp.patch<{ category: SafeCategory }>(`/categories/${categoryId}/status`, { isVisible });
}

export function deleteCategory(categoryId: string) {
  return authHttp.delete<Record<string, never>>(`/categories/${categoryId}`);
}
