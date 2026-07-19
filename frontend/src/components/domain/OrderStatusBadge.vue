<script setup lang="ts">
import { computed } from "vue";

import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABEL } from "../../constants/order-status";
import type { OrderStatus } from "../../types/enums";

const props = defineProps<{ status: OrderStatus }>();

const label = computed(() => ORDER_STATUS_LABEL[props.status]);
const badgeClass = computed(() => ORDER_STATUS_BADGE_CLASS[props.status]);
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
    :class="badgeClass"
  >
    {{ label }}
  </span>
</template>
