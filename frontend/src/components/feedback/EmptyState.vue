<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    actionLabel?: string;
  }>(),
  { description: undefined, actionLabel: undefined },
);

defineEmits<{ action: [] }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
    <h2 class="text-base font-semibold text-bz-ink-900">{{ title }}</h2>
    <p v-if="description" class="max-w-xs text-sm text-bz-ink-500">{{ description }}</p>
    <button
      v-if="actionLabel"
      type="button"
      class="mt-4 rounded-full bg-bz-gold-600 px-5 py-2 text-sm font-medium text-white shadow-bz-sm"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
