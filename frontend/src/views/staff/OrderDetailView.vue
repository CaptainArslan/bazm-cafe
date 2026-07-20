<!-- frontend/src/views/staff/OrderDetailView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import CustomerAttachPanel from "../../components/domain/CustomerAttachPanel.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import ReasonConfirmationDialog from "../../components/feedback/ReasonConfirmationDialog.vue";
import OrderStatusBadge from "../../components/domain/OrderStatusBadge.vue";
import OrderStatusTimeline from "../../components/domain/OrderStatusTimeline.vue";
import PaymentStatusBadge from "../../components/domain/PaymentStatusBadge.vue";
import { generateRecoveryCode } from "../../api/staff-guest-sessions";
import { getStaffReceiptUrl } from "../../api/staff-orders";
import { getAccessToken } from "../../api/http";
import { useStaffOrdersStore } from "../../stores/staff-orders.store";
import { CustomerType, OrderStatus } from "../../types/enums";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const props = defineProps<{ orderId: string }>();
const router = useRouter();
const staffOrdersStore = useStaffOrdersStore();

const loading = ref(true);
const loadError = ref<string | null>(null);
const actionError = ref<string | null>(null);
const showRejectDialog = ref(false);
const rejecting = ref(false);
const recoveryCode = ref<{ code: string; expiresAt: string } | null>(null);
const generatingCode = ref(false);
const viewingReceipt = ref(false);

const order = computed(() => staffOrdersStore.findOrder(props.orderId));

const canMarkServed = computed(() => {
  if (!order.value) {
    return false;
  }
  return order.value.orderType !== CustomerType.DINE_IN || order.value.customerId !== null;
});

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    await staffOrdersStore.fetchOrder(props.orderId);
  } catch (caught) {
    loadError.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function runAction(action: () => Promise<void>): Promise<void> {
  actionError.value = null;
  try {
    await action();
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  }
}

async function onAccept(): Promise<void> {
  await runAction(() => staffOrdersStore.accept(props.orderId));
}

async function onStartPreparing(): Promise<void> {
  await runAction(() => staffOrdersStore.startPreparing(props.orderId));
}

async function onMarkReady(): Promise<void> {
  await runAction(() => staffOrdersStore.markReady(props.orderId));
}

async function onMarkServed(): Promise<void> {
  await runAction(() => staffOrdersStore.markServed(props.orderId));
}

async function onConfirmReject(reason: string): Promise<void> {
  rejecting.value = true;
  try {
    await staffOrdersStore.reject(props.orderId, reason);
    showRejectDialog.value = false;
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  } finally {
    rejecting.value = false;
  }
}

async function onGenerateRecoveryCode(): Promise<void> {
  if (!order.value?.guestSessionId) {
    return;
  }
  generatingCode.value = true;
  actionError.value = null;
  try {
    const result = await generateRecoveryCode(order.value.guestSessionId);
    recoveryCode.value = { code: result.recoveryCode, expiresAt: result.expiresAt };
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  } finally {
    generatingCode.value = false;
  }
}

async function onViewReceipt(): Promise<void> {
  if (!order.value) {
    return;
  }
  viewingReceipt.value = true;
  actionError.value = null;
  try {
    const token = getAccessToken();
    const response = await fetch(getStaffReceiptUrl(order.value.id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error("Could not load the receipt.");
    }
    const html = await response.text();
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const receiptWindow = window.open(blobUrl, "_blank", "noopener");
    if (!receiptWindow) {
      actionError.value = "Please allow pop-ups to view the receipt.";
    }
  } catch (caught) {
    actionError.value = caught instanceof Error ? caught.message : "Could not load the receipt.";
  } finally {
    viewingReceipt.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6">
    <button
      type="button"
      class="mb-4 self-start text-sm text-bz-ink-500 underline underline-offset-2"
      @click="router.push({ name: 'staff.home' })"
    >
      ← Back to queue
    </button>

    <LoadingState v-if="loading" label="Loading order..." />
    <ErrorState v-else-if="loadError || !order" :message="loadError ?? 'Order not found.'" @retry="load" />

    <template v-else>
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-bz-ink-900">{{ order.orderNumber }}</h1>
        <div class="flex gap-2">
          <OrderStatusBadge :status="order.orderStatus" />
          <PaymentStatusBadge :status="order.paymentStatus" />
        </div>
      </div>

      <p class="mt-1 text-sm text-bz-ink-500">
        <span v-if="order.tableNumber">Table {{ order.tableNumber }}</span>
        <span v-else>Takeaway</span>
        <span v-if="order.customerName"> · {{ order.customerName }}</span>
      </p>

      <div class="mt-5 rounded-2xl border border-bz-border bg-white p-4">
        <OrderStatusTimeline :status="order.orderStatus" />
      </div>

      <div class="mt-5 rounded-2xl border border-bz-border bg-white p-4">
        <div
          v-for="(item, index) in order.items"
          :key="index"
          class="flex items-center justify-between py-1 text-sm"
        >
          <span class="text-bz-ink-700">{{ item.quantity }}× {{ item.productNameSnapshot }}</span>
          <span class="font-medium text-bz-ink-900">Rs. {{ item.lineTotal }}</span>
        </div>
        <div class="mt-3 flex justify-between border-t border-bz-border pt-3 text-sm font-semibold text-bz-ink-900">
          <span>Total</span><span>Rs. {{ order.totalAmount }}</span>
        </div>
      </div>

      <p v-if="actionError" class="mt-4 rounded-xl bg-bz-red-tint px-4 py-3 text-sm text-bz-red">{{ actionError }}</p>

      <div class="mt-5 flex gap-3">
        <template v-if="order.orderStatus === OrderStatus.PENDING">
          <button
            type="button"
            data-test="accept"
            class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white"
            @click="onAccept"
          >
            Accept
          </button>
          <button
            type="button"
            data-test="reject"
            class="flex-1 rounded-full border border-bz-red py-2.5 text-sm font-medium text-bz-red"
            @click="showRejectDialog = true"
          >
            Reject
          </button>
        </template>
        <button
          v-else-if="order.orderStatus === OrderStatus.ACCEPTED"
          type="button"
          data-test="start-preparing"
          class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white"
          @click="onStartPreparing"
        >
          Start Preparing
        </button>
        <button
          v-else-if="order.orderStatus === OrderStatus.PREPARING"
          type="button"
          data-test="mark-ready"
          class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white"
          @click="onMarkReady"
        >
          Mark Ready
        </button>
        <div v-else-if="order.orderStatus === OrderStatus.READY" class="flex-1">
          <button
            type="button"
            data-test="mark-served"
            class="w-full rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            :disabled="!canMarkServed"
            @click="onMarkServed"
          >
            Mark Served
          </button>
          <p v-if="!canMarkServed" class="mt-2 text-xs text-bz-red">
            Attach a customer before marking this order served.
          </p>
        </div>
      </div>

      <CustomerAttachPanel
        v-if="order.customerId === null"
        class="mt-5"
        :order-id="order.id"
        @attached="load"
      />

      <div v-if="order.orderType === CustomerType.DINE_IN && order.guestSessionId" class="mt-5 rounded-2xl border border-bz-border bg-white p-4">
        <h2 class="text-sm font-semibold text-bz-ink-900">Recovery code</h2>
        <p class="mt-1 text-xs text-bz-ink-500">
          Generate a code the guest can use to reclaim this session on another device. Valid for a few minutes.
        </p>
        <button
          type="button"
          data-test="generate-recovery-code"
          class="mt-3 rounded-full border border-bz-border px-4 py-2 text-sm font-medium text-bz-ink-900 disabled:opacity-60"
          :disabled="generatingCode"
          @click="onGenerateRecoveryCode"
        >
          {{ generatingCode ? "Generating..." : "Generate Recovery Code" }}
        </button>
        <p v-if="recoveryCode" class="mt-3 rounded-xl bg-bz-amber-tint px-3 py-2 text-sm text-bz-ink-900">
          Code: <span class="font-mono font-semibold">{{ recoveryCode.code }}</span>
        </p>
      </div>

      <button
        type="button"
        data-test="view-receipt"
        class="mt-5 block w-full rounded-full border border-bz-border py-2.5 text-center text-sm font-medium text-bz-ink-900 disabled:opacity-60"
        :disabled="viewingReceipt"
        @click="onViewReceipt"
      >
        {{ viewingReceipt ? "Loading..." : "View Receipt" }}
      </button>
    </template>

    <ReasonConfirmationDialog
      :open="showRejectDialog"
      title="Reject this order?"
      description="Tell the customer why this order was rejected."
      confirm-label="Reject Order"
      :confirming="rejecting"
      @cancel="showRejectDialog = false"
      @confirm="onConfirmReject"
    />
  </main>
</template>
