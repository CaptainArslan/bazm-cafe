<script setup lang="ts">
import { computed } from "vue";

import { CustomerType } from "../../types/enums";
import type { SafeGuestSession } from "../../types/session";

const props = defineProps<{
  session: SafeGuestSession;
  outstandingBalance: number;
}>();

const visitLabel = computed(() =>
  props.session.orderType === CustomerType.DINE_IN
    ? `Table ${props.session.tableNumber ?? "-"}`
    : "Takeaway",
);
</script>

<template>
  <div class="rounded-2xl bg-bz-cream p-4">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold text-bz-ink-900">{{ visitLabel }}</span>
      <span class="text-xs text-bz-ink-500">Session active</span>
    </div>
    <div class="mt-2 flex items-baseline justify-between">
      <span class="text-xs text-bz-ink-500">Outstanding balance</span>
      <span
        class="text-lg font-semibold"
        :class="outstandingBalance > 0 ? 'text-bz-red' : 'text-bz-green-deep'"
      >
        Rs. {{ outstandingBalance.toFixed(2) }}
      </span>
    </div>
  </div>
</template>
