<script setup lang="ts">
defineProps<{ message: string }>();
</script>

<template>
  <div
    class="flex items-start gap-2 rounded-xl bg-bz-red-tint px-4 py-3 text-sm text-bz-red"
    role="alert"
  >
    <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1 1 0 0 0 3 19.5h18a1 1 0 0 0 .87-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z" />
    </svg>
    <span>{{ message }}</span>
  </div>
</template>
