<!-- frontend/src/views/admin/OrdersView.vue -->
<script setup lang="ts">
import { onMounted, ref } from "vue";

import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import OrderStatusBadge from "../../components/domain/OrderStatusBadge.vue";
import PaymentStatusBadge from "../../components/domain/PaymentStatusBadge.vue";
import OrderDetailPanel from "./OrderDetailPanel.vue";
import { useStaffOrdersStore } from "../../stores/staff-orders.store";
import { useStaffSocketStore } from "../../stores/staff-socket.store";
import { OrderStatus } from "../../types/enums";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const staffOrdersStore = useStaffOrdersStore();
const staffSocketStore = useStaffSocketStore();

const FILTERS: Array<{ key: string; label: string; status?: OrderStatus }> = [
  { key: "ALL", label: "All" },
  { key: OrderStatus.PENDING, label: "Pending", status: OrderStatus.PENDING },
  { key: OrderStatus.ACCEPTED, label: "Accepted", status: OrderStatus.ACCEPTED },
  { key: OrderStatus.PREPARING, label: "Preparing", status: OrderStatus.PREPARING },
  { key: OrderStatus.READY, label: "Ready", status: OrderStatus.READY },
  { key: OrderStatus.SERVED, label: "Served", status: OrderStatus.SERVED },
  { key: OrderStatus.CANCELLED, label: "Cancelled", status: OrderStatus.CANCELLED },
];

const activeFilterKey = ref("ALL");
const expandedOrderId = ref<string | null>(null);

async function selectFilter(key: string, status?: OrderStatus): Promise<void> {
  activeFilterKey.value = key;
  await staffOrdersStore.fetchOrders(status ? { status } : {});
}

function toggleExpanded(orderId: string): void {
  expandedOrderId.value = expandedOrderId.value === orderId ? null : orderId;
}

onMounted(() => {
  staffSocketStore.init();
  void staffOrdersStore.fetchOrders();
});
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header>
      <h1 class="text-xl font-bold text-bz-ink-900">Orders</h1>
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
      <div v-for="order in staffOrdersStore.orders" :key="order.id">
        <button
          type="button"
          :data-test="`open-order-${order.id}`"
          class="block w-full rounded-2xl border border-bz-border bg-white p-4 text-left shadow-bz-sm"
          @click="toggleExpanded(order.id)"
        >
          <div class="flex items-center justify-between">
            <span class="font-semibold text-bz-ink-900">{{ order.orderNumber }}</span>
            <div class="flex items-center gap-2">
              <OrderStatusBadge :status="order.orderStatus" />
              <PaymentStatusBadge :status="order.paymentStatus" />
            </div>
          </div>
          <div class="mt-2 text-sm text-bz-ink-500">
            <span v-if="order.tableNumber">Table {{ order.tableNumber }}</span>
            <span v-else>Takeaway</span>
            <span v-if="order.customerName"> · {{ order.customerName }}</span>
          </div>
          <div class="mt-3 flex items-center justify-between text-sm text-bz-ink-500">
            <span>{{ order.items.length }} item(s)</span>
            <span class="font-medium text-bz-ink-900">Rs. {{ order.totalAmount }}</span>
          </div>
        </button>

        <OrderDetailPanel v-if="expandedOrderId === order.id" :order="order" />
      </div>
    </div>
  </main>
</template>
