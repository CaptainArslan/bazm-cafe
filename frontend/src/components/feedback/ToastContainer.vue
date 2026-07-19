<script setup lang="ts">
import { storeToRefs } from "pinia";

import { useToastStore } from "../../stores/toast.store";

const toastStore = useToastStore();
const { toasts } = storeToRefs(toastStore);

const typeClasses: Record<string, string> = {
  success: "bg-bz-ink-900 text-white",
  error: "bg-bz-red text-white",
  info: "bg-white text-bz-ink-900 border border-bz-border",
};
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
    <TransitionGroup name="toast" tag="div" class="flex w-full max-w-sm flex-col gap-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm shadow-bz-sm"
        :class="typeClasses[toast.type]"
        role="status"
      >
        <span>{{ toast.message }}</span>
        <button type="button" class="shrink-0 opacity-70 hover:opacity-100" @click="toastStore.dismiss(toast.id)">
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
