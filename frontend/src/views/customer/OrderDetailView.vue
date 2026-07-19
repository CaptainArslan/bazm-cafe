<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { getGuestReceiptUrl } from "../../api/orders";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import OrderStatusBadge from "../../components/domain/OrderStatusBadge.vue";
import OrderStatusTimeline from "../../components/domain/OrderStatusTimeline.vue";
import PaymentStatusBadge from "../../components/domain/PaymentStatusBadge.vue";
import { useOrdersStore } from "../../stores/orders.store";

const props = defineProps<{ orderId: string }>();

const router = useRouter();
const ordersStore = useOrdersStore();
const loading = ref(true);
const loadError = ref(false);

const order = computed(() => ordersStore.findOrder(props.orderId));

async function load() {
  loading.value = true;
  loadError.value = false;
  try {
    await ordersStore.fetchOrder(props.orderId);
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6">
    <button
      type="button"
      class="mb-4 self-start text-sm text-bz-ink-500 underline underline-offset-2"
      @click="router.push({ name: 'customer.session' })"
    >
      ← Back to session
    </button>

    <LoadingState v-if="loading" label="Loading order..." />
    <ErrorState v-else-if="loadError || !order" message="This order could not be found." @retry="load" />

    <template v-else>
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-bz-ink-900">{{ order.orderNumber }}</h1>
        <div class="flex gap-2">
          <OrderStatusBadge :status="order.orderStatus" />
          <PaymentStatusBadge :status="order.paymentStatus" />
        </div>
      </div>

      <div class="mt-5 rounded-2xl border border-bz-border bg-white p-4">
        <OrderStatusTimeline :status="order.orderStatus" />
      </div>

      <p v-if="order.rejectionReason" class="mt-3 text-sm text-bz-red">
        Rejected: {{ order.rejectionReason }}
      </p>
      <p v-if="order.cancellationReason" class="mt-3 text-sm text-bz-red">
        Cancelled: {{ order.cancellationReason }}
      </p>

      <div class="mt-5 rounded-2xl border border-bz-border bg-white p-4">
        <div
          v-for="(item, index) in order.items"
          :key="index"
          class="flex items-center justify-between py-1 text-sm"
        >
          <span class="text-bz-ink-700">{{ item.quantity }}× {{ item.productNameSnapshot }}</span>
          <span class="font-medium text-bz-ink-900">Rs. {{ item.lineTotal }}</span>
        </div>

        <div class="mt-3 space-y-1 border-t border-bz-border pt-3 text-sm">
          <div class="flex justify-between text-bz-ink-500">
            <span>Subtotal</span><span>Rs. {{ order.subtotal }}</span>
          </div>
          <div v-if="Number(order.taxAmount) > 0" class="flex justify-between text-bz-ink-500">
            <span>Tax</span><span>Rs. {{ order.taxAmount }}</span>
          </div>
          <div
            v-if="Number(order.serviceChargeAmount) > 0"
            class="flex justify-between text-bz-ink-500"
          >
            <span>Service charge</span><span>Rs. {{ order.serviceChargeAmount }}</span>
          </div>
          <div class="flex justify-between font-semibold text-bz-ink-900">
            <span>Total</span><span>Rs. {{ order.totalAmount }}</span>
          </div>
          <div class="flex justify-between text-bz-ink-500">
            <span>Paid</span><span>Rs. {{ order.paidAmount }}</span>
          </div>
          <div v-if="Number(order.remainingAmount) > 0" class="flex justify-between font-semibold text-bz-red">
            <span>Remaining</span><span>Rs. {{ order.remainingAmount }}</span>
          </div>
        </div>
      </div>

      <div class="mt-5 flex gap-3">
        <a
          :href="getGuestReceiptUrl(order.id)"
          target="_blank"
          rel="noopener"
          class="flex-1 rounded-full border border-bz-border py-2.5 text-center text-sm font-medium text-bz-ink-900"
        >
          View Receipt
        </a>
        <a
          v-if="order.receiptImageUrl"
          :href="order.receiptImageUrl"
          download
          class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-center text-sm font-medium text-white"
        >
          Download Receipt
        </a>
      </div>
    </template>
  </main>
</template>
