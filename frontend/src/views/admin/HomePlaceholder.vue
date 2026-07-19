<!-- frontend/src/views/admin/HomePlaceholder.vue -->
<script setup lang="ts">
import { useRouter } from "vue-router";

import { useAuthStore } from "../../stores/auth.store";

const authStore = useAuthStore();
const router = useRouter();

async function onLogout(): Promise<void> {
  await authStore.logout();
  router.replace({ name: "admin.login" });
}
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 class="text-xl font-bold text-bz-ink-900">Admin Dashboard</h1>
    <p class="text-sm text-bz-ink-500">
      Signed in as {{ authStore.user?.name }} ({{ authStore.role }}). The back-office screens are coming next.
    </p>
    <button
      type="button"
      class="rounded-full bg-bz-ink-900 px-5 py-2 text-sm font-medium text-white"
      @click="onLogout"
    >
      Sign out
    </button>
  </main>
</template>
