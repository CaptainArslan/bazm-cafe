<!-- frontend/src/views/admin/OrderDetailPanel.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";

import ReasonConfirmationDialog from "../../components/feedback/ReasonConfirmationDialog.vue";
import OrderStatusTimeline from "../../components/domain/OrderStatusTimeline.vue";
import { useStaffOrdersStore } from "../../stores/staff-orders.store";
import { OrderStatus } from "../../types/enums";
import type { SafeOrder } from "../../types/order";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const props = defineProps<{ order: SafeOrder }>();
const staffOrdersStore = useStaffOrdersStore();

const CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY];

const actionError = ref<string | null>(null);
const showRejectDialog = ref(false);
const showCancelDialog = ref(false);
const rejecting = ref(false);
const cancelling = ref(false);

const canCancel = computed(() => CANCELLABLE_STATUSES.includes(props.order.orderStatus));

async function runAction(action: () => Promise<void>): Promise<void> {
  actionError.value = null;
  try {
    await action();
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  }
}

async function onAccept(): Promise<void> {
  await runAction(() => staffOrdersStore.accept(props.order.id));
}

async function onStartPreparing(): Promise<void> {
  await runAction(() => staffOrdersStore.startPreparing(props.order.id));
}

async function onMarkReady(): Promise<void> {
  await runAction(() => staffOrdersStore.markReady(props.order.id));
}

async function onMarkServed(): Promise<void> {
  await runAction(() => staffOrdersStore.markServed(props.order.id));
}

async function onConfirmReject(reason: string): Promise<void> {
  rejecting.value = true;
  try {
    await staffOrdersStore.reject(props.order.id, reason);
    showRejectDialog.value = false;
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  } finally {
    rejecting.value = false;
  }
}

async function onConfirmCancel(reason: string): Promise<void> {
  cancelling.value = true;
  try {
    await staffOrdersStore.cancel(props.order.id, reason);
    showCancelDialog.value = false;
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  } finally {
    cancelling.value = false;
  }
}
</script>

<template>
  <div class="mt-3 rounded-2xl border border-bz-border bg-white p-4">
    <OrderStatusTimeline :status="order.orderStatus" />

    <p v-if="order.rejectionReason" class="mt-3 text-sm text-bz-red">Rejected: {{ order.rejectionReason }}</p>
    <p v-if="order.cancellationReason" class="mt-3 text-sm text-bz-red">Cancelled: {{ order.cancellationReason }}</p>

    <div class="mt-3 border-t border-bz-border pt-3">
      <div v-for="(item, index) in order.items" :key="index" class="flex items-center justify-between py-1 text-sm">
        <span class="text-bz-ink-700">{{ item.quantity }}× {{ item.productNameSnapshot }}</span>
        <span class="font-medium text-bz-ink-900">Rs. {{ item.lineTotal }}</span>
      </div>
      <div class="mt-2 flex justify-between border-t border-bz-border pt-2 text-sm font-semibold text-bz-ink-900">
        <span>Total</span><span>Rs. {{ order.totalAmount }}</span>
      </div>
    </div>

    <p v-if="actionError" class="mt-3 rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">{{ actionError }}</p>

    <div class="mt-4 flex flex-wrap gap-3">
      <template v-if="order.orderStatus === OrderStatus.PENDING">
        <button
          type="button"
          data-test="accept-order"
          class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white"
          @click="onAccept"
        >
          Accept
        </button>
        <button
          type="button"
          data-test="reject-order"
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
      <button
        v-else-if="order.orderStatus === OrderStatus.READY"
        type="button"
        data-test="mark-served"
        class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white"
        @click="onMarkServed"
      >
        Mark Served
      </button>

      <button
        v-if="canCancel"
        type="button"
        data-test="cancel-order"
        class="flex-1 rounded-full border border-bz-red py-2.5 text-sm font-medium text-bz-red"
        @click="showCancelDialog = true"
      >
        Cancel Order
      </button>
    </div>

    <ReasonConfirmationDialog
      :open="showRejectDialog"
      title="Reject this order?"
      description="Tell the customer why this order was rejected."
      confirm-label="Reject Order"
      :confirming="rejecting"
      @cancel="showRejectDialog = false"
      @confirm="onConfirmReject"
    />

    <ReasonConfirmationDialog
      :open="showCancelDialog"
      title="Cancel this order?"
      description="Tell the customer why this order was cancelled."
      confirm-label="Cancel Order"
      :confirming="cancelling"
      @cancel="showCancelDialog = false"
      @confirm="onConfirmCancel"
    />
  </div>
</template>
