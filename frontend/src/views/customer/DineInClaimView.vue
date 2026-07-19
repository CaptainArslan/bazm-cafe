<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { ApiError } from "../../api/http";
import LoadingState from "../../components/feedback/LoadingState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import { useGuestSessionStore } from "../../stores/guest-session.store";

const props = defineProps<{ tableToken: string }>();

const router = useRouter();
const guestSessionStore = useGuestSessionStore();

const state = ref<"loading" | "occupied" | "error">("loading");
const errorMessage = ref("");

async function claim() {
  state.value = "loading";

  try {
    await guestSessionStore.startDineIn(props.tableToken);
    await router.replace({ name: "customer.session" });
  } catch (caught) {
    if (caught instanceof ApiError && caught.code === "TABLE_SESSION_ALREADY_ACTIVE") {
      state.value = "occupied";
      return;
    }

    errorMessage.value =
      caught instanceof ApiError
        ? caught.message
        : "This table link could not be validated.";
    state.value = "error";
  }
}

onMounted(claim);
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-6">
    <LoadingState v-if="state === 'loading'" label="Opening your table..." />

    <div v-else-if="state === 'occupied'" class="text-center">
      <h1 class="text-lg font-semibold text-bz-ink-900">Table already in use</h1>
      <p class="mt-2 max-w-xs text-sm text-bz-ink-500">
        This table has an active session on another device. Ask a staff member for a
        recovery code to continue on this phone.
      </p>
      <RouterLink
        :to="{ name: 'customer.recovery' }"
        class="mt-5 inline-block rounded-full bg-bz-gold-600 px-5 py-2 text-sm font-medium text-white shadow-bz-sm"
      >
        Enter recovery code
      </RouterLink>
    </div>

    <ErrorState
      v-else
      title="Table unavailable"
      :message="errorMessage"
      retry-label="Try again"
      @retry="claim"
    />
  </main>
</template>
