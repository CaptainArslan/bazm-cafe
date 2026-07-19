<script setup lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { z } from "zod";

import { ApiError } from "../../api/http";
import BusinessRuleError from "../../components/feedback/BusinessRuleError.vue";
import { useCartStore } from "../../stores/cart.store";
import { useGuestSessionStore } from "../../stores/guest-session.store";
import { useOrdersStore } from "../../stores/orders.store";

const router = useRouter();
const cartStore = useCartStore();
const guestSessionStore = useGuestSessionStore();
const ordersStore = useOrdersStore();

if (cartStore.items.length === 0) {
  router.replace({ name: "customer.cart" });
}

const schema = computed(() =>
  toTypedSchema(
    z
      .object({
        customerName: z.string().trim().max(100).optional(),
        customerPhone: z.string().trim().max(30).optional(),
        customerNotes: z.string().trim().max(1000).optional(),
      })
      .superRefine((data, ctx) => {
        if (!guestSessionStore.isTakeaway) {
          return;
        }
        if (!data.customerName) {
          ctx.addIssue({ code: "custom", message: "Name is required.", path: ["customerName"] });
        }
        if (!data.customerPhone || data.customerPhone.length < 5) {
          ctx.addIssue({
            code: "custom",
            message: "A valid phone number is required.",
            path: ["customerPhone"],
          });
        }
      }),
  ),
);

const { defineField, handleSubmit, errors, isSubmitting } = useForm({
  validationSchema: schema,
});

const [customerName, customerNameAttrs] = defineField("customerName");
const [customerPhone, customerPhoneAttrs] = defineField("customerPhone");
const [customerNotes, customerNotesAttrs] = defineField("customerNotes");

const serverError = ref("");

const onSubmit = handleSubmit(async (values) => {
  serverError.value = "";

  try {
    const order = await ordersStore.submitOrder({
      items: cartStore.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
      })),
      customerName: values.customerName || undefined,
      customerPhone: values.customerPhone || undefined,
      customerNotes: values.customerNotes || undefined,
    });
    cartStore.clear();
    await router.replace({ name: "customer.order-detail", params: { orderId: order.id } });
  } catch (caught) {
    if (caught instanceof ApiError) {
      if (caught.code === "PRODUCT_UNAVAILABLE" || caught.code === "INSUFFICIENT_STOCK") {
        await router.replace({ name: "customer.cart" });
        return;
      }
      serverError.value = caught.message;
    } else {
      serverError.value = "Could not place your order.";
    }
  }
});
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6">
    <h1 class="text-xl font-bold text-bz-ink-900">Checkout</h1>

    <div class="mt-4 rounded-2xl border border-bz-border bg-white p-4">
      <div
        v-for="item in cartStore.items"
        :key="item.productId"
        class="flex items-center justify-between py-1 text-sm"
      >
        <span class="text-bz-ink-700">{{ item.quantity }}× {{ item.name }}</span>
        <span class="font-medium text-bz-ink-900">
          Rs. {{ (Number(item.price) * item.quantity).toFixed(2) }}
        </span>
      </div>
      <div class="mt-2 flex items-center justify-between border-t border-bz-border pt-2 text-sm font-semibold">
        <span>Subtotal</span>
        <span>Rs. {{ cartStore.subtotal.toFixed(2) }}</span>
      </div>
    </div>

    <form class="mt-5 space-y-4" @submit="onSubmit">
      <template v-if="guestSessionStore.isTakeaway">
        <div>
          <label class="text-xs font-medium text-bz-ink-500">Your name</label>
          <input
            v-model="customerName"
            v-bind="customerNameAttrs"
            type="text"
            class="mt-1 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
          />
          <p v-if="errors.customerName" class="mt-1 text-xs text-bz-red">{{ errors.customerName }}</p>
        </div>
        <div>
          <label class="text-xs font-medium text-bz-ink-500">Phone number</label>
          <input
            v-model="customerPhone"
            v-bind="customerPhoneAttrs"
            type="tel"
            class="mt-1 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
          />
          <p v-if="errors.customerPhone" class="mt-1 text-xs text-bz-red">{{ errors.customerPhone }}</p>
        </div>
      </template>

      <div>
        <label class="text-xs font-medium text-bz-ink-500">Order note (optional)</label>
        <textarea
          v-model="customerNotes"
          v-bind="customerNotesAttrs"
          rows="2"
          class="mt-1 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>

      <BusinessRuleError v-if="serverError" :message="serverError" />

      <button
        type="submit"
        class="w-full rounded-full bg-bz-gold-600 py-3 text-sm font-medium text-white shadow-bz-sm disabled:opacity-60"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? "Placing order..." : "Place Order" }}
      </button>
    </form>
  </main>
</template>
