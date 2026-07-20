<script setup lang="ts"></script>

<template>
  <div class="min-h-dvh bg-bz-bg font-sans text-bz-ink-900">
    <div class="flex items-center justify-between border-b border-bz-border bg-white px-4 py-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-bz-ink-500">BAZM Staff</span>
      <RouterLink :to="{ name: 'staff.settings' }" class="text-xs font-medium text-bz-gold-700 underline underline-offset-2">
        Settings
      </RouterLink>
    </div>
    <RouterView />
  </div>
</template>
