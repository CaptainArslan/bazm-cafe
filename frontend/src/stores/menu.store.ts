import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { getGuestMenu } from "../api/menu";
import { ApiError } from "../api/http";
import type { SafeProduct } from "../types/product";

export const useMenuStore = defineStore("menu", () => {
  const products = ref<SafeProduct[]>([]);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  const loaded = ref(false);

  const categories = computed(() => {
    const seen = new Map<string, string>();
    for (const product of products.value) {
      if (!seen.has(product.categoryId)) {
        seen.set(product.categoryId, product.categoryName);
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  });

  function productsByCategory(categoryId: string): SafeProduct[] {
    return products.value
      .filter((product) => product.categoryId === categoryId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  function findProduct(productId: string): SafeProduct | undefined {
    return products.value.find((product) => product.id === productId);
  }

  async function fetchMenu(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await getGuestMenu();
      products.value = result.products;
      loaded.value = true;
    } catch (caught) {
      if (caught instanceof ApiError) {
        error.value = caught;
      }
    } finally {
      loading.value = false;
    }
  }

  return { products, loading, error, loaded, categories, productsByCategory, findProduct, fetchMenu };
});
