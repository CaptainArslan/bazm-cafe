<script setup lang="ts">
import type { SafeOrder } from "../../types/order";
import OrderStatusBadge from "./OrderStatusBadge.vue";
import PaymentStatusBadge from "./PaymentStatusBadge.vue";

defineProps<{ order: SafeOrder }>();
</script>

<template>
  <RouterLink
    :to="{ name: 'staff.order-detail', params: { orderId: order.id } }"
    class="block rounded-2xl border border-bz-border bg-white p-4 shadow-bz-sm"
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
    <div v-if="Number(order.remainingAmount) > 0" class="mt-1 text-xs text-bz-red">
      Rs. {{ order.remainingAmount }} remaining
    </div>
  </RouterLink>
</template>
