<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    message: string;
    retryLabel?: string;
  }>(),
  { title: "Something went wrong", retryLabel: "Try again" },
);

defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-bz-red-tint text-bz-red">
      <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1 1 0 0 0 3 19.5h18a1 1 0 0 0 .87-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z" />
      </svg>
    </div>
    <h2 class="text-base font-semibold text-bz-ink-900">{{ title }}</h2>
    <p class="max-w-xs text-sm text-bz-ink-500">{{ message }}</p>
    <button
      type="button"
      class="mt-4 rounded-full bg-bz-gold-600 px-5 py-2 text-sm font-medium text-white shadow-bz-sm"
      @click="$emit('retry')"
    >
      {{ retryLabel }}
    </button>
  </div>
</template>
