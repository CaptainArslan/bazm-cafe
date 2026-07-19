<!-- frontend/src/components/auth/LoginForm.vue -->
<script setup lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import { ref } from "vue";
import { z } from "zod";

import { useAuthStore } from "../../stores/auth.store";
import { toUserSafeErrorMessage } from "../../utils/error-message";
import type { SafeUser } from "../../types/auth";
import BusinessRuleError from "../feedback/BusinessRuleError.vue";

defineProps<{ title: string }>();
const emit = defineEmits<{ success: [user: SafeUser] }>();

const authStore = useAuthStore();

const schema = toTypedSchema(
  z.object({
    email: z.string().trim().min(1, "Email is required.").email("Enter a valid email."),
    password: z.string().min(1, "Password is required."),
  }),
);

const { defineField, handleSubmit, errors, isSubmitting } = useForm({ validationSchema: schema });
const [email, emailAttrs] = defineField("email");
const [password, passwordAttrs] = defineField("password");

const serverError = ref("");

const onSubmit = handleSubmit(async (values) => {
  serverError.value = "";
  try {
    const user = await authStore.login(values.email, values.password);
    emit("success", user);
  } catch (caught) {
    serverError.value = toUserSafeErrorMessage(caught);
  }
});
</script>

<template>
  <form class="w-full max-w-sm space-y-4" @submit="onSubmit">
    <h1 class="text-xl font-bold text-bz-ink-900">{{ title }}</h1>

    <div>
      <label class="text-xs font-medium text-bz-ink-500">Email</label>
      <input
        v-model="email"
        v-bind="emailAttrs"
        type="email"
        autocomplete="username"
        class="mt-1 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
      <p v-if="errors.email" class="mt-1 text-xs text-bz-red">{{ errors.email }}</p>
    </div>

    <div>
      <label class="text-xs font-medium text-bz-ink-500">Password</label>
      <input
        v-model="password"
        v-bind="passwordAttrs"
        type="password"
        autocomplete="current-password"
        class="mt-1 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
      <p v-if="errors.password" class="mt-1 text-xs text-bz-red">{{ errors.password }}</p>
    </div>

    <BusinessRuleError v-if="serverError" :message="serverError" />

    <button
      type="submit"
      class="w-full rounded-full bg-bz-gold-600 py-3 text-sm font-medium text-white shadow-bz-sm disabled:opacity-60"
      :disabled="isSubmitting"
    >
      {{ isSubmitting ? "Signing in..." : "Sign in" }}
    </button>
  </form>
</template>
