import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

import type { SafeProduct } from "../types/product";

export type CartItem = {
  productId: string;
  name: string;
  price: string;
  quantity: number;
  notes?: string;
  imagePath: string | null;
};

const STORAGE_KEY = "bazm.cart.v1";

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export const useCartStore = defineStore("cart", () => {
  const items = ref<CartItem[]>(loadFromStorage());

  watch(
    items,
    (value) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    },
    { deep: true },
  );

  const totalItems = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0),
  );

  const subtotal = computed(() =>
    items.value.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
  );

  function addItem(product: SafeProduct, quantity = 1): void {
    const existing = items.value.find((item) => item.productId === product.id);

    if (existing) {
      existing.quantity += quantity;
      return;
    }

    items.value.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      imagePath: product.imagePath,
    });
  }

  function updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    const existing = items.value.find((item) => item.productId === productId);
    if (existing) {
      existing.quantity = quantity;
    }
  }

  function updateNotes(productId: string, notes: string): void {
    const existing = items.value.find((item) => item.productId === productId);
    if (existing) {
      existing.notes = notes;
    }
  }

  function removeItem(productId: string): void {
    items.value = items.value.filter((item) => item.productId !== productId);
  }

  function clear(): void {
    items.value = [];
  }

  return { items, totalItems, subtotal, addItem, updateQuantity, updateNotes, removeItem, clear };
});
