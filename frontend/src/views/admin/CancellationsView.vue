<!-- frontend/src/views/admin/CancellationsView.vue -->
<script setup lang="ts">
import { onMounted, ref } from "vue";

import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { listStaffOrders } from "../../api/staff-orders";
import type { SafeOrder } from "../../types/order";
import { OrderStatus } from "../../types/enums";
import { formatCurrency, formatDateTime } from "../../utils/currency";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const loading = ref(true);
const error = ref<string | null>(null);
const cancelledOrders = ref<SafeOrder[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await listStaffOrders({ status: OrderStatus.CANCELLED });
    cancelledOrders.value = result.orders;
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header>
      <h1 class="text-xl font-bold text-bz-ink-900">Cancellations</h1>
      <p class="mt-1 text-sm text-bz-ink-500">A read-only audit of every cancelled order.</p>
    </header>

    <LoadingState v-if="loading && cancelledOrders.length === 0" label="Loading cancellations..." />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <EmptyState
      v-else-if="cancelledOrders.length === 0"
      class="mt-6"
      title="No cancellations"
      description="Cancelled orders will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <div
        v-for="order in cancelledOrders"
        :key="order.id"
        :data-test="`cancellation-${order.id}`"
        class="rounded-2xl border border-bz-border bg-white p-4 shadow-bz-sm"
      >
        <div class="flex items-center justify-between">
          <span class="font-semibold text-bz-ink-900">{{ order.orderNumber }}</span>
          <span class="font-medium text-bz-ink-900">{{ formatCurrency(order.totalAmount) }}</span>
        </div>
        <div class="mt-2 text-sm text-bz-ink-500">
          <span v-if="order.tableNumber">Table {{ order.tableNumber }}</span>
          <span v-else>Takeaway</span>
          <span v-if="order.cancelledAt"> · Cancelled {{ formatDateTime(order.cancelledAt) }}</span>
        </div>
        <p v-if="order.cancellationReason" class="mt-2 text-sm text-bz-ink-700">
          {{ order.cancellationReason }}
        </p>
      </div>
    </div>
  </main>
</template>
