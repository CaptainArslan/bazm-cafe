<!-- frontend/src/views/staff/OrderQueueView.vue -->
<script setup lang="ts">
import { onMounted, ref } from "vue";

import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import StaffOrderCard from "../../components/domain/StaffOrderCard.vue";
import { useAuthStore } from "../../stores/auth.store";
import { useStaffOrdersStore } from "../../stores/staff-orders.store";
import { OrderStatus } from "../../types/enums";
import { toUserSafeErrorMessage } from "../../utils/error-message";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const staffOrdersStore = useStaffOrdersStore();
const router = useRouter();

const FILTERS: Array<{ key: string; label: string; status?: OrderStatus }> = [
  { key: "ALL", label: "All" },
  { key: OrderStatus.PENDING, label: "Pending", status: OrderStatus.PENDING },
  { key: OrderStatus.ACCEPTED, label: "Accepted", status: OrderStatus.ACCEPTED },
  { key: OrderStatus.PREPARING, label: "Preparing", status: OrderStatus.PREPARING },
  { key: OrderStatus.READY, label: "Ready", status: OrderStatus.READY },
  { key: OrderStatus.SERVED, label: "Served", status: OrderStatus.SERVED },
];

const activeFilterKey = ref("ALL");

async function selectFilter(key: string, status?: OrderStatus): Promise<void> {
  activeFilterKey.value = key;
  await staffOrdersStore.fetchOrders(status ? { status } : {});
}

onMounted(() => {
  void staffOrdersStore.fetchOrders();
});

async function onLogout(): Promise<void> {
  await authStore.logout();
  router.replace({ name: "staff.login" });
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold tracking-widest text-bz-gold-700 uppercase">BAZM Café</p>
        <h1 class="mt-1 text-xl font-bold text-bz-ink-900">Order Queue</h1>
      </div>
      <button type="button" class="text-sm text-bz-ink-500 underline underline-offset-2" @click="onLogout">
        Sign out
      </button>
    </header>

    <div class="mt-4 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="filter in FILTERS"
        :key="filter.key"
        type="button"
        :data-test="`filter-${filter.key}`"
        class="shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium"
        :class="
          activeFilterKey === filter.key
            ? 'border-bz-gold-600 bg-bz-gold-600 text-white'
            : 'border-bz-border bg-white text-bz-ink-700'
        "
        @click="selectFilter(filter.key, filter.status)"
      >
        {{ filter.label }}
      </button>
    </div>

    <LoadingState v-if="staffOrdersStore.loading && staffOrdersStore.orders.length === 0" label="Loading orders..." />

    <ErrorState
      v-else-if="staffOrdersStore.error"
      :message="toUserSafeErrorMessage(staffOrdersStore.error)"
      @retry="() => staffOrdersStore.refetchCurrentFilters()"
    />

    <EmptyState
      v-else-if="staffOrdersStore.orders.length === 0"
      class="mt-6"
      title="No orders"
      description="Orders matching this filter will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <StaffOrderCard v-for="order in staffOrdersStore.orders" :key="order.id" :order="order" />
    </div>
  </main>
</template>
