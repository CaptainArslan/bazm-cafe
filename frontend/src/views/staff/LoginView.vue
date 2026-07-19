<!-- frontend/src/views/staff/LoginView.vue -->
<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

import LoginForm from "../../components/auth/LoginForm.vue";

const router = useRouter();
const route = useRoute();

function onSuccess(): void {
  const redirect = route.query.redirect;
  const target = typeof redirect === "string" && redirect.startsWith("/staff") ? redirect : "/staff";
  router.replace(target);
}
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center px-6">
    <LoginForm title="Staff Sign In" @success="onSuccess" />
  </main>
</template>
