<script setup lang="ts">
import { computed } from "vue";

import { ORDER_STATUS_LABEL, ORDER_STATUS_TIMELINE } from "../../constants/order-status";
import { OrderStatus } from "../../types/enums";

const props = defineProps<{ status: OrderStatus }>();

const isTerminalNegative = computed(
  () => props.status === OrderStatus.REJECTED || props.status === OrderStatus.CANCELLED,
);

const currentIndex = computed(() => ORDER_STATUS_TIMELINE.indexOf(props.status));
</script>

<template>
  <div v-if="isTerminalNegative" class="flex items-center gap-2 text-sm font-medium text-bz-red">
    <span class="h-2.5 w-2.5 rounded-full bg-bz-red" />
    {{ ORDER_STATUS_LABEL[status] }}
  </div>

  <ol v-else class="flex items-center">
    <li
      v-for="(step, index) in ORDER_STATUS_TIMELINE"
      :key="step"
      class="flex flex-1 items-center last:flex-none"
    >
      <div class="flex flex-col items-center gap-1">
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
          :class="
            index <= currentIndex
              ? 'bg-bz-gold-600 text-white'
              : 'bg-bz-ink-100 text-bz-ink-500'
          "
        >
          {{ index + 1 }}
        </span>
        <span
          class="text-[11px] whitespace-nowrap"
          :class="index <= currentIndex ? 'text-bz-ink-900' : 'text-bz-ink-300'"
        >
          {{ ORDER_STATUS_LABEL[step] }}
        </span>
      </div>
      <div
        v-if="index < ORDER_STATUS_TIMELINE.length - 1"
        class="mx-1 mb-4 h-px flex-1"
        :class="index < currentIndex ? 'bg-bz-gold-600' : 'bg-bz-ink-100'"
      />
    </li>
  </ol>
</template>
