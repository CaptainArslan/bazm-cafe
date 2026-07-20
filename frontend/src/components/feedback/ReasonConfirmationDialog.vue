<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirming?: boolean;
    minLength?: number;
  }>(),
  { confirmLabel: "Confirm", cancelLabel: "Cancel", confirming: false, minLength: 3 },
);

const emit = defineEmits<{ confirm: [reason: string]; cancel: [] }>();

const reason = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      reason.value = "";
    }
  },
);

const trimmedReason = computed(() => reason.value.trim());
const canConfirm = computed(() => trimmedReason.value.length >= props.minLength);

function onConfirm(): void {
  if (!canConfirm.value) {
    return;
  }
  emit("confirm", trimmedReason.value);
}
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
      <textarea
        v-model="reason"
        rows="3"
        class="mt-3 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
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
          class="flex-1 rounded-full bg-bz-red py-2.5 text-sm font-medium text-white disabled:opacity-60"
          :disabled="confirming || !canConfirm"
          @click="onConfirm"
        >
          {{ confirming ? "Please wait..." : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
