<script setup lang="ts">
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
    <div class="flex h-14 w-14 items-center justify-center rounded-full bg-bz-green-tint text-bz-green-deep">
      <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1 class="mt-4 text-xl font-bold text-bz-ink-900">Session Ended</h1>
    <p class="mt-2 max-w-xs text-sm text-bz-ink-500">
      Thank you for visiting BAZM Café. Your receipts remain accessible for 24 hours.
    </p>
    <RouterLink
      :to="{ name: 'customer.welcome' }"
      class="mt-6 rounded-full bg-bz-gold-600 px-6 py-2.5 text-sm font-medium text-white shadow-bz-sm"
    >
      Start a new visit
    </RouterLink>
  </main>
</template>
