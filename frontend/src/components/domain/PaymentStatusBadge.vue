<script setup lang="ts">
import { computed } from "vue";

import { PAYMENT_STATUS_BADGE_CLASS, PAYMENT_STATUS_LABEL } from "../../constants/order-status";
import type { OrderPaymentStatus } from "../../types/enums";

const props = defineProps<{ status: OrderPaymentStatus }>();

const label = computed(() => PAYMENT_STATUS_LABEL[props.status]);
const badgeClass = computed(() => PAYMENT_STATUS_BADGE_CLASS[props.status]);
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
    :class="badgeClass"
  >
    {{ label }}
  </span>
</template>
