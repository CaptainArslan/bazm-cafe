<script setup lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { z } from "zod";

import { ApiError } from "../../api/http";
import BusinessRuleError from "../../components/feedback/BusinessRuleError.vue";
import { useGuestSessionStore } from "../../stores/guest-session.store";

const router = useRouter();
const guestSessionStore = useGuestSessionStore();

const schema = toTypedSchema(
  z.object({
    recoveryCode: z
      .string()
      .trim()
      .min(6, "Recovery code is too short.")
      .max(32, "Recovery code is too long."),
  }),
);

const { defineField, handleSubmit, errors, isSubmitting } = useForm({
  validationSchema: schema,
});

const [recoveryCode, recoveryCodeAttrs] = defineField("recoveryCode");
const serverError = ref("");

const onSubmit = handleSubmit(async (values) => {
  serverError.value = "";

  try {
    await guestSessionStore.recover(values.recoveryCode);
    await router.replace({ name: "customer.session" });
  } catch (caught) {
    serverError.value =
      caught instanceof ApiError ? caught.message : "Could not redeem that code.";
  }
});
</script>

<template>
  <main class="flex min-h-dvh flex-col justify-center px-6 py-12">
    <div class="text-center">
      <p class="text-sm font-semibold tracking-widest text-bz-gold-700 uppercase">BAZM Café</p>
      <h1 class="mt-3 text-2xl font-bold text-bz-ink-900">Enter recovery code</h1>
      <p class="mt-2 text-sm text-bz-ink-500">
        Ask a staff member for the 5-minute code to restore your session on this phone.
      </p>
    </div>

    <form class="mt-8 space-y-4" @submit="onSubmit">
      <div>
        <input
          v-model="recoveryCode"
          v-bind="recoveryCodeAttrs"
          type="text"
          autocomplete="one-time-code"
          placeholder="Recovery code"
          class="w-full rounded-full border border-bz-border bg-white px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-bz-gold-500"
        />
        <p v-if="errors.recoveryCode" class="mt-1 text-center text-xs text-bz-red">
          {{ errors.recoveryCode }}
        </p>
      </div>

      <BusinessRuleError v-if="serverError" :message="serverError" />

      <button
        type="submit"
        class="w-full rounded-full bg-bz-gold-600 py-3 text-sm font-medium text-white shadow-bz-sm disabled:opacity-60"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? "Verifying..." : "Continue" }}
      </button>
      <RouterLink
        :to="{ name: 'customer.welcome' }"
        class="block text-center text-sm text-bz-ink-500 underline underline-offset-2"
      >
        Back
      </RouterLink>
    </form>
  </main>
</template>
