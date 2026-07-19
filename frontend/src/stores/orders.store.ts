import { defineStore } from "pinia";
import { computed, ref } from "vue";

import {
  createGuestOrder,
  getGuestOrder,
  listGuestOrders,
  type CreateGuestOrderInput,
} from "../api/orders";
import { ApiError } from "../api/http";
import type { SafeOrder } from "../types/order";

export const useOrdersStore = defineStore("orders", () => {
  const orders = ref<SafeOrder[]>([]);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);

  const outstandingBalance = computed(() =>
    orders.value.reduce((sum, order) => sum + Number(order.remainingAmount), 0),
  );

  function upsert(order: SafeOrder): void {
    const index = orders.value.findIndex((existing) => existing.id === order.id);
    if (index === -1) {
      orders.value.push(order);
    } else {
      orders.value[index] = order;
    }
  }

  function findOrder(orderId: string): SafeOrder | undefined {
    return orders.value.find((order) => order.id === orderId);
  }

  async function fetchOrders(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const result = await listGuestOrders();
      orders.value = result.orders;
    } catch (caught) {
      if (caught instanceof ApiError) {
        error.value = caught;
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchOrder(orderId: string): Promise<void> {
    const result = await getGuestOrder(orderId);
    upsert(result.order);
  }

  async function submitOrder(input: CreateGuestOrderInput): Promise<SafeOrder> {
    const result = await createGuestOrder(input);
    upsert(result.order);
    return result.order;
  }

  function clear(): void {
    orders.value = [];
  }

  return {
    orders,
    loading,
    error,
    outstandingBalance,
    fetchOrders,
    fetchOrder,
    submitOrder,
    findOrder,
    clear,
  };
});
