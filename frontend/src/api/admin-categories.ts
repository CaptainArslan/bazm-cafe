import { endpoints } from "./endpoints";
import { authHttp } from "./http";
import type { CreateCategoryInput, SafeCategory, UpdateCategoryInput } from "../types/category";

export function listCategories() {
  return authHttp.get<{ categories: SafeCategory[] }>(endpoints.categories.list);
}

export function getCategory(categoryId: string) {
  return authHttp.get<{ category: SafeCategory }>(endpoints.categories.detail(categoryId));
}

export function createCategory(input: CreateCategoryInput) {
  return authHttp.post<{ category: SafeCategory }>(endpoints.categories.list, input);
}

export function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  return authHttp.patch<{ category: SafeCategory }>(endpoints.categories.detail(categoryId), input);
}

export function updateCategoryStatus(categoryId: string, isVisible: boolean) {
  return authHttp.patch<{ category: SafeCategory }>(endpoints.categories.status(categoryId), { isVisible });
}

export function deleteCategory(categoryId: string) {
  return authHttp.delete<Record<string, never>>(endpoints.categories.detail(categoryId));
}
