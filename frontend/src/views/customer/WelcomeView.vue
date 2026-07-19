<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { useGuestSessionStore } from "../../stores/guest-session.store";

const router = useRouter();
const guestSessionStore = useGuestSessionStore();

const checkingSession = ref(true);
const manualTableToken = ref("");
const tokenError = ref("");
const showManualEntry = ref(false);

onMounted(async () => {
  await guestSessionStore.ensureFetched();
  checkingSession.value = false;

  if (guestSessionStore.isActive) {
    await router.replace({ name: "customer.session" });
  }
});

function submitManualToken() {
  const token = manualTableToken.value.trim();

  if (token.length === 0) {
    tokenError.value = "Enter the table code first.";
    return;
  }

  if (token.length < 32) {
    tokenError.value = "That doesn't look like a valid table code (too short).";
    return;
  }

  tokenError.value = "";
  router.push({ name: "customer.dine-in-claim", params: { tableToken: token } });
}
</script>

<template>
  <main v-if="!checkingSession" class="flex min-h-dvh flex-col justify-between px-6 py-12">
    <div class="text-center">
      <p class="text-sm font-semibold tracking-widest text-bz-gold-700 uppercase">BAZM Café</p>
      <h1 class="mt-3 text-2xl font-bold text-bz-ink-900">Welcome</h1>
      <p class="mt-2 text-sm text-bz-ink-500">How would you like to order today?</p>
    </div>

    <div class="space-y-4">
      <div class="rounded-2xl border border-bz-border bg-white p-5 shadow-bz-sm">
        <h2 class="font-semibold text-bz-ink-900">Dine In</h2>
        <p class="mt-1 text-sm text-bz-ink-500">Scan the QR code printed on your table.</p>

        <RouterLink
          :to="{ name: 'customer.scan-qr' }"
          class="mt-4 flex items-center justify-center gap-2 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white shadow-bz-sm"
        >
          Scan QR Code
        </RouterLink>

        <button
          type="button"
          class="mt-2 w-full text-center text-xs text-bz-ink-500 underline underline-offset-2"
          @click="showManualEntry = !showManualEntry"
        >
          {{ showManualEntry ? "Hide manual entry" : "Enter table code manually" }}
        </button>

        <form v-if="showManualEntry" class="mt-3 flex gap-2" @submit.prevent="submitManualToken">
          <input
            v-model="manualTableToken"
            type="text"
            placeholder="Table code"
            class="min-w-0 flex-1 rounded-full border border-bz-border bg-bz-bg px-4 py-2 text-sm outline-none focus:border-bz-gold-500"
          />
          <button
            type="submit"
            class="shrink-0 rounded-full bg-bz-cream px-4 py-2 text-sm font-medium text-bz-ink-900 shadow-bz-sm"
          >
            Go
          </button>
        </form>
        <p v-if="tokenError" class="mt-2 text-xs text-bz-red">{{ tokenError }}</p>
      </div>

      <RouterLink
        :to="{ name: 'customer.takeaway-start' }"
        class="block rounded-2xl border border-bz-border bg-white p-5 text-center shadow-bz-sm"
      >
        <h2 class="font-semibold text-bz-ink-900">Takeaway</h2>
        <p class="mt-1 text-sm text-bz-ink-500">Order for pickup, no table needed.</p>
      </RouterLink>

      <RouterLink
        :to="{ name: 'customer.recovery' }"
        class="block text-center text-sm text-bz-ink-500 underline underline-offset-2"
      >
        Have a staff recovery code?
      </RouterLink>
    </div>
  </main>
</template>
