<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: "Loading..." });
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-16 text-bz-ink-500">
    <div
      class="h-8 w-8 animate-spin rounded-full border-2 border-bz-gold-200 border-t-bz-gold-600"
      role="status"
      aria-label="Loading"
    />
    <p class="text-sm">{{ label }}</p>
  </div>
</template>
