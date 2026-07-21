<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
    <h1 class="text-xl font-bold text-bz-ink-900">{{ title }}</h1>
    <p class="text-sm text-bz-ink-500">Coming soon.</p>
  </main>
</template>
