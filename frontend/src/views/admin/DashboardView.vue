<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { listAdminPayments } from "../../api/admin-payments";
import { listAdminProducts } from "../../api/admin-products";
import { listStaffOrders } from "../../api/staff-orders";
import { useAuthStore } from "../../stores/auth.store";
import { OrderStatus, PaymentStatus } from "../../types/enums";
import type { SafeOrder } from "../../types/order";
import type { SafePayment } from "../../types/payment";
import type { SafeProduct } from "../../types/product";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const authStore = useAuthStore();

const loading = ref(true);
const loadError = ref<string | null>(null);
const orders = ref<SafeOrder[]>([]);
const payments = ref<SafePayment[]>([]);
const products = ref<SafeProduct[]>([]);

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

const todaysOrderCount = computed(() => orders.value.filter((order) => isToday(order.createdAt)).length);

const needsAttentionCount = computed(
  () =>
    orders.value.filter(
      (order) => order.orderStatus === OrderStatus.PENDING || order.orderStatus === OrderStatus.ACCEPTED,
    ).length,
);

const todaysRevenue = computed(() =>
  payments.value
    .filter(
      (payment) =>
        payment.status === PaymentStatus.COMPLETED && payment.voidedAt === null && isToday(payment.createdAt),
    )
    .reduce((sum, payment) => sum + Number(payment.amount), 0),
);

const lowStockCount = computed(
  () => products.value.filter((product) => product.availableQuantity <= product.lowStockThreshold).length,
);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const [ordersResult, paymentsResult, productsResult] = await Promise.all([
      listStaffOrders(),
      listAdminPayments(),
      listAdminProducts(),
    ]);
    orders.value = ordersResult.orders;
    payments.value = paymentsResult.payments;
    products.value = productsResult.products;
  } catch (caught) {
    loadError.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6">
    <h1 class="text-xl font-bold text-bz-ink-900">Dashboard</h1>
    <p class="mt-1 text-sm text-bz-ink-500">Signed in as {{ authStore.user?.name }} ({{ authStore.role }}).</p>

    <LoadingState v-if="loading" label="Loading dashboard..." />
    <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />

    <div v-else class="mt-4 grid grid-cols-2 gap-3">
      <div class="rounded-2xl border border-bz-border bg-white p-4" data-test="tile-todays-orders">
        <p class="text-xs uppercase tracking-wide text-bz-ink-500">Today's Orders</p>
        <p class="mt-1 text-2xl font-bold text-bz-ink-900">{{ todaysOrderCount }}</p>
      </div>
      <div class="rounded-2xl border border-bz-border bg-white p-4" data-test="tile-needs-attention">
        <p class="text-xs uppercase tracking-wide text-bz-ink-500">Needs Attention</p>
        <p class="mt-1 text-2xl font-bold text-bz-ink-900">{{ needsAttentionCount }}</p>
      </div>
      <div class="rounded-2xl border border-bz-border bg-white p-4" data-test="tile-todays-revenue">
        <p class="text-xs uppercase tracking-wide text-bz-ink-500">Today's Revenue</p>
        <p class="mt-1 text-2xl font-bold text-bz-ink-900">{{ todaysRevenue.toFixed(2) }}</p>
      </div>
      <div class="rounded-2xl border border-bz-border bg-white p-4" data-test="tile-low-stock">
        <p class="text-xs uppercase tracking-wide text-bz-ink-500">Low Stock</p>
        <p class="mt-1 text-2xl font-bold text-bz-ink-900">{{ lowStockCount }}</p>
      </div>
    </div>
  </main>
</template>
