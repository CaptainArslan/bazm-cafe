import { defineStore } from "pinia";
import { ref } from "vue";

import {
  acceptOrder,
  attachCustomerToOrder,
  getStaffOrder,
  listStaffOrders,
  markOrderReady,
  markOrderServed,
  rejectOrder,
  startPreparingOrder,
  type AttachCustomerInput,
  type StaffOrderFilters,
} from "../api/staff-orders";
import { ApiError } from "../api/http";
import type { SafeOrder } from "../types/order";

export const useStaffOrdersStore = defineStore("staffOrders", () => {
  const orders = ref<SafeOrder[]>([]);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  const activeFilters = ref<StaffOrderFilters>({});

  function upsert(order: SafeOrder): void {
    const index = orders.value.findIndex((existing) => existing.id === order.id);
    if (index === -1) {
      orders.value.push(order);
    } else {
      orders.value[index] = order;
    }
  }

  async function fetchOrders(filters: StaffOrderFilters = {}): Promise<void> {
    loading.value = true;
    error.value = null;
    activeFilters.value = filters;

    try {
      const result = await listStaffOrders(filters);
      orders.value = result.orders;
    } catch (caught) {
      if (caught instanceof ApiError) {
        error.value = caught;
      }
    } finally {
      loading.value = false;
    }
  }

  async function refetchCurrentFilters(): Promise<void> {
    await fetchOrders(activeFilters.value);
  }

  async function fetchOrder(orderId: string): Promise<void> {
    const result = await getStaffOrder(orderId);
    upsert(result.order);
  }

  async function accept(orderId: string): Promise<void> {
    const result = await acceptOrder(orderId);
    upsert(result.order);
  }

  async function startPreparing(orderId: string): Promise<void> {
    const result = await startPreparingOrder(orderId);
    upsert(result.order);
  }

  async function markReady(orderId: string): Promise<void> {
    const result = await markOrderReady(orderId);
    upsert(result.order);
  }

  async function markServed(orderId: string): Promise<void> {
    const result = await markOrderServed(orderId);
    upsert(result.order);
  }

  async function reject(orderId: string, reason: string): Promise<void> {
    const result = await rejectOrder(orderId, reason);
    upsert(result.order);
  }

  async function attachCustomer(orderId: string, input: AttachCustomerInput): Promise<void> {
    const result = await attachCustomerToOrder(orderId, input);
    upsert(result.order);
  }

  function findOrder(orderId: string): SafeOrder | undefined {
    return orders.value.find((order) => order.id === orderId);
  }

  return {
    orders,
    loading,
    error,
    activeFilters,
    fetchOrders,
    refetchCurrentFilters,
    fetchOrder,
    accept,
    startPreparing,
    markReady,
    markServed,
    reject,
    attachCustomer,
    findOrder,
  };
});
