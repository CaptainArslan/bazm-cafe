<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

import { ApiError } from "../../api/http";
import BusinessRuleError from "../../components/feedback/BusinessRuleError.vue";
import { useGuestSessionStore } from "../../stores/guest-session.store";

const router = useRouter();
const guestSessionStore = useGuestSessionStore();

const submitting = ref(false);
const errorMessage = ref("");

async function start() {
  submitting.value = true;
  errorMessage.value = "";

  try {
    await guestSessionStore.startTakeaway();
    await router.replace({ name: "customer.session" });
  } catch (caught) {
    errorMessage.value =
      caught instanceof ApiError ? caught.message : "Could not start your order.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col justify-between px-6 py-12">
    <div class="text-center">
      <p class="text-sm font-semibold tracking-widest text-bz-gold-700 uppercase">BAZM Café</p>
      <h1 class="mt-3 text-2xl font-bold text-bz-ink-900">Takeaway</h1>
      <p class="mt-2 text-sm text-bz-ink-500">
        We'll ask for your name and phone number at checkout.
      </p>
    </div>

    <div class="space-y-4">
      <BusinessRuleError v-if="errorMessage" :message="errorMessage" />
      <button
        type="button"
        class="w-full rounded-full bg-bz-gold-600 py-3 text-sm font-medium text-white shadow-bz-sm disabled:opacity-60"
        :disabled="submitting"
        @click="start"
      >
        {{ submitting ? "Starting..." : "Start Takeaway Order" }}
      </button>
      <RouterLink
        :to="{ name: 'customer.welcome' }"
        class="block text-center text-sm text-bz-ink-500 underline underline-offset-2"
      >
        Back
      </RouterLink>
    </div>
  </main>
</template>
