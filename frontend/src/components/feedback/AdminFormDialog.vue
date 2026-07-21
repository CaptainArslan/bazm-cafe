<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    saving?: boolean;
    saveLabel?: string;
    cancelLabel?: string;
    error?: string | null;
  }>(),
  { saving: false, saveLabel: "Save", cancelLabel: "Cancel", error: null },
);

const emit = defineEmits<{ save: []; cancel: [] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    @click.self="emit('cancel')"
  >
    <div class="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-bz-lg sm:rounded-2xl">
      <h2 class="text-base font-semibold text-bz-ink-900">{{ title }}</h2>
      <div class="mt-4 space-y-3">
        <slot />
      </div>
      <p v-if="error" class="mt-3 rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">{{ error }}</p>
      <div class="mt-5 flex gap-3">
        <button
          type="button"
          data-test="dialog-cancel"
          class="flex-1 rounded-full border border-bz-border py-2.5 text-sm font-medium text-bz-ink-700"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          data-test="dialog-save"
          class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          :disabled="saving"
          @click="emit('save')"
        >
          {{ saving ? "Saving..." : saveLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
