import { defineStore } from "pinia";
import { ref } from "vue";

import { searchCustomers } from "../api/staff-customers";
import { ApiError } from "../api/http";
import type { SafeCustomer } from "../types/customer";

export const useStaffCustomersStore = defineStore("staffCustomers", () => {
  const results = ref<SafeCustomer[]>([]);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);

  async function search(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      results.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const result = await searchCustomers({ search: trimmed });
      results.value = result.customers;
    } catch (caught) {
      if (caught instanceof ApiError) {
        error.value = caught;
      }
    } finally {
      loading.value = false;
    }
  }

  return { results, loading, error, search };
});
