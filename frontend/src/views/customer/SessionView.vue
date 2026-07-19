<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { ApiError } from "../../api/http";
import ActionConfirmationDialog from "../../components/feedback/ActionConfirmationDialog.vue";
import BusinessRuleError from "../../components/feedback/BusinessRuleError.vue";
import EmptyState from "../../components/feedback/EmptyState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import OrderCard from "../../components/domain/OrderCard.vue";
import SessionSummary from "../../components/domain/SessionSummary.vue";
import { OrderStatus } from "../../types/enums";
import { useGuestSessionStore } from "../../stores/guest-session.store";
import { useOrdersStore } from "../../stores/orders.store";
import { useSocketStore } from "../../stores/socket.store";

const router = useRouter();
const guestSessionStore = useGuestSessionStore();
const ordersStore = useOrdersStore();
const socketStore = useSocketStore();

const showEndSessionDialog = ref(false);
const ending = ref(false);
const blockReason = ref("");

onMounted(async () => {
  socketStore.init();
  await ordersStore.fetchOrders();
});

const sortedOrders = computed(() =>
  [...ordersStore.orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ),
);

const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.REJECTED,
  OrderStatus.CANCELLED,
];

const blockingOrders = computed(() =>
  ordersStore.orders.filter(
    (order) =>
      !TERMINAL_STATUSES.includes(order.orderStatus) || Number(order.remainingAmount) > 0,
  ),
);

async function confirmEndSession() {
  ending.value = true;
  blockReason.value = "";

  try {
    await guestSessionStore.endSession();
    showEndSessionDialog.value = false;
    await router.replace({ name: "customer.session-closed" });
  } catch (caught) {
    if (caught instanceof ApiError && caught.code === "SESSION_NOT_RELEASABLE") {
      blockReason.value =
        blockingOrders.value.length > 0
          ? `${blockingOrders.value.length} order(s) still need to finish or be paid before you can end this session.`
          : caught.message;
    } else {
      blockReason.value =
        caught instanceof ApiError ? caught.message : "Could not end the session.";
    }
  } finally {
    ending.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold tracking-widest text-bz-gold-700 uppercase">BAZM Café</p>
        <h1 class="mt-1 text-xl font-bold text-bz-ink-900">Your Session</h1>
      </div>
    </header>

    <SessionSummary
      v-if="guestSessionStore.session"
      class="mt-4"
      :session="guestSessionStore.session"
      :outstanding-balance="ordersStore.outstandingBalance"
    />

    <LoadingState v-if="ordersStore.loading && sortedOrders.length === 0" label="Loading your orders..." />

    <EmptyState
      v-else-if="sortedOrders.length === 0"
      class="mt-6"
      title="No orders yet"
      description="Browse the menu to place your first order."
      action-label="Browse Menu"
      @action="router.push({ name: 'customer.menu' })"
    />

    <div v-else class="mt-4 space-y-3">
      <OrderCard v-for="order in sortedOrders" :key="order.id" :order="order" />
    </div>

    <button
      type="button"
      class="mt-6 w-full rounded-full bg-bz-gold-600 py-3 text-sm font-medium text-white shadow-bz-sm"
      @click="router.push({ name: 'customer.menu' })"
    >
      {{ sortedOrders.length === 0 ? "Browse Menu" : "Place Another Order" }}
    </button>

    <BusinessRuleError v-if="blockReason" class="mt-4" :message="blockReason" />

    <button
      type="button"
      class="mt-3 text-sm text-bz-ink-500 underline underline-offset-2"
      @click="showEndSessionDialog = true"
    >
      End Session
    </button>

    <ActionConfirmationDialog
      :open="showEndSessionDialog"
      title="End this session?"
      description="This closes your visit. You'll still be able to access receipts for 24 hours."
      confirm-label="End Session"
      :confirming="ending"
      @cancel="showEndSessionDialog = false"
      @confirm="confirmEndSession"
    />
  </main>
</template>
