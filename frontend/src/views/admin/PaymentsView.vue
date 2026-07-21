<!-- frontend/src/views/admin/PaymentsView.vue -->
<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import AdminFormDialog from "../../components/feedback/AdminFormDialog.vue";
import ReasonConfirmationDialog from "../../components/feedback/ReasonConfirmationDialog.vue";
import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { listAdminPayments, recordPayment, reversePayment } from "../../api/admin-payments";
import { listStaffOrders } from "../../api/staff-orders";
import type { SafePayment } from "../../types/payment";
import type { SafeOrder } from "../../types/order";
import { OrderStatus, PaymentMethod, PaymentStatus } from "../../types/enums";
import { formatCurrency, formatDateTime } from "../../utils/currency";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const PAYMENT_STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: "bg-bz-gold-100 text-bz-ink-700",
  [PaymentStatus.COMPLETED]: "bg-bz-green-tint text-bz-green",
  [PaymentStatus.FAILED]: "bg-bz-red-tint text-bz-red",
  [PaymentStatus.REFUNDED]: "bg-bz-red-tint text-bz-red",
};

const loading = ref(true);
const error = ref<string | null>(null);
const payments = ref<SafePayment[]>([]);
const actionError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await listAdminPayments();
    payments.value = result.payments;
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function canReverse(payment: SafePayment): boolean {
  return payment.voidedAt === null && payment.status === PaymentStatus.COMPLETED;
}

function replacePayment(updated: SafePayment): void {
  const index = payments.value.findIndex((entry) => entry.id === updated.id);
  if (index !== -1) payments.value[index] = updated;
}

// --- Reverse dialog ---

const showReverseDialog = ref(false);
const reversingPaymentId = ref<string | null>(null);
const reversing = ref(false);

function openReverseDialog(payment: SafePayment): void {
  if (!canReverse(payment)) {
    return;
  }
  reversingPaymentId.value = payment.id;
  showReverseDialog.value = true;
}

function closeReverseDialog(): void {
  showReverseDialog.value = false;
}

async function onConfirmReverse(reason: string): Promise<void> {
  if (!reversingPaymentId.value) {
    return;
  }
  reversing.value = true;
  try {
    const result = await reversePayment(reversingPaymentId.value, reason);
    replacePayment(result.payment);
    closeReverseDialog();
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  } finally {
    reversing.value = false;
  }
}

// --- Record payment dialog ---

const formDialogOpen = ref(false);
const formSaving = ref(false);
const formError = ref<string | null>(null);
const eligibleOrders = ref<SafeOrder[]>([]);
const form = reactive({
  orderId: "",
  amount: "",
  method: PaymentMethod.CASH as PaymentMethod,
  reference: "",
});

async function openNewPaymentDialog(): Promise<void> {
  form.orderId = "";
  form.amount = "";
  form.method = PaymentMethod.CASH;
  form.reference = "";
  formError.value = null;
  formDialogOpen.value = true;
  try {
    const result = await listStaffOrders({ status: OrderStatus.SERVED });
    eligibleOrders.value = result.orders.filter((order) => Number(order.remainingAmount) > 0);
    if (!form.orderId) {
      form.orderId = eligibleOrders.value[0]?.id ?? "";
    }
  } catch (caught) {
    formError.value = toUserSafeErrorMessage(caught);
  }
}

function closeFormDialog(): void {
  formDialogOpen.value = false;
}

async function saveForm(): Promise<void> {
  formSaving.value = true;
  formError.value = null;
  try {
    const reference = form.reference.trim();
    const result = await recordPayment(form.orderId, {
      amount: Number(form.amount),
      method: form.method,
      ...(reference ? { reference } : {}),
    });
    payments.value = [result.payment, ...payments.value];
    closeFormDialog();
  } catch (caught) {
    formError.value = toUserSafeErrorMessage(caught);
  } finally {
    formSaving.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-bz-ink-900">Payments</h1>
      <button
        type="button"
        data-test="new-payment"
        class="rounded-full bg-bz-gold-600 px-4 py-2 text-sm font-medium text-white shadow-bz-sm"
        @click="openNewPaymentDialog"
      >
        + Record Payment
      </button>
    </header>

    <div v-if="actionError" class="mt-3 rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">
      {{ actionError }}
    </div>

    <LoadingState v-if="loading && payments.length === 0" label="Loading payments..." />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <EmptyState
      v-else-if="payments.length === 0"
      class="mt-6"
      title="No payments"
      description="Payments you record will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <div
        v-for="payment in payments"
        :key="payment.id"
        class="rounded-2xl border border-bz-border bg-white p-4 shadow-bz-sm"
      >
        <div class="flex items-center justify-between">
          <span class="font-semibold text-bz-ink-900">{{ payment.paymentNumber }}</span>
          <span
            class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
            :class="PAYMENT_STATUS_BADGE_CLASS[payment.status]"
          >
            {{ payment.status }}
          </span>
        </div>
        <div class="mt-2 flex items-center justify-between text-sm text-bz-ink-700">
          <span>{{ formatCurrency(payment.amount) }} · {{ payment.method }}</span>
        </div>
        <div class="mt-1 text-sm text-bz-ink-500">
          <span v-if="payment.reference">Ref: {{ payment.reference }}</span>
          <span v-if="payment.paidAt"> · Paid {{ formatDateTime(payment.paidAt) }}</span>
        </div>
        <p v-if="payment.voidReason" class="mt-2 text-sm text-bz-red">Reversed: {{ payment.voidReason }}</p>

        <div class="mt-3">
          <button
            type="button"
            :data-test="`reverse-${payment.id}`"
            class="rounded-full border border-bz-red px-3 py-1.5 text-sm font-medium text-bz-red disabled:opacity-60"
            :disabled="!canReverse(payment)"
            @click="openReverseDialog(payment)"
          >
            Reverse
          </button>
        </div>
      </div>
    </div>

    <ReasonConfirmationDialog
      :open="showReverseDialog"
      title="Reverse this payment?"
      description="Explain why this payment is being reversed."
      confirm-label="Reverse Payment"
      :confirming="reversing"
      @cancel="closeReverseDialog"
      @confirm="onConfirmReverse"
    />

    <AdminFormDialog
      :open="formDialogOpen"
      title="Record Payment"
      :saving="formSaving"
      :error="formError"
      @save="saveForm"
      @cancel="closeFormDialog"
    >
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Order</label>
        <select
          v-model="form.orderId"
          data-test="field-order"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        >
          <option v-for="order in eligibleOrders" :key="order.id" :value="order.id">
            {{ order.orderNumber }} · {{ formatCurrency(order.remainingAmount) }} due
          </option>
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Amount</label>
        <input
          v-model="form.amount"
          data-test="field-amount"
          type="number"
          min="0"
          step="0.01"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Method</label>
        <select
          v-model="form.method"
          data-test="field-method"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        >
          <option v-for="method in Object.values(PaymentMethod)" :key="method" :value="method">{{ method }}</option>
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Reference (optional)</label>
        <input
          v-model="form.reference"
          data-test="field-reference"
          type="text"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
    </AdminFormDialog>
  </main>
</template>
