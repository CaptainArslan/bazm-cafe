<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirming?: boolean;
    destructive?: boolean;
  }>(),
  { confirmLabel: "Confirm", cancelLabel: "Cancel", confirming: false, destructive: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    @click.self="emit('cancel')"
  >
    <div class="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-bz-lg sm:rounded-2xl">
      <h2 class="text-base font-semibold text-bz-ink-900">{{ title }}</h2>
      <p class="mt-2 text-sm text-bz-ink-500">{{ description }}</p>
      <div class="mt-5 flex gap-3">
        <button
          type="button"
          data-test="cancel"
          class="flex-1 rounded-full border border-bz-border py-2.5 text-sm font-medium text-bz-ink-700"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          data-test="confirm"
          class="flex-1 rounded-full py-2.5 text-sm font-medium text-white disabled:opacity-60"
          :class="destructive ? 'bg-bz-red' : 'bg-bz-gold-600'"
          :disabled="confirming"
          @click="emit('confirm')"
        >
          {{ confirming ? "Please wait..." : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
