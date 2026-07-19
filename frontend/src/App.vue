<script setup lang="ts">
import { onMounted } from "vue";

import ToastContainer from "./components/feedback/ToastContainer.vue";
import { registerSessionExpiredHandler } from "./lib/session-expired-bus";
import router from "./router";
import { useToastStore } from "./stores/toast.store";

const toastStore = useToastStore();

onMounted(() => {
  registerSessionExpiredHandler(() => {
    toastStore.push("info", "Your session has expired. Please sign in again.");
    const currentPath = router.currentRoute.value.path;
    const target = currentPath.startsWith("/admin") ? "admin.login" : "staff.login";
    router.push({ name: target });
  });
});
</script>

<template>
  <div>
    <ToastContainer />
    <RouterView />
  </div>
</template>
