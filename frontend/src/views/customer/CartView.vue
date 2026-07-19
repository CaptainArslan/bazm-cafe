<script setup lang="ts">
import { useRouter } from "vue-router";

import EmptyState from "../../components/feedback/EmptyState.vue";
import { useCartStore } from "../../stores/cart.store";

const router = useRouter();
const cartStore = useCartStore();
</script>

<template>
  <main class="flex min-h-dvh flex-col pb-28">
    <header class="px-5 pt-6 pb-3">
      <h1 class="text-xl font-bold text-bz-ink-900">Your Cart</h1>
    </header>

    <EmptyState
      v-if="cartStore.items.length === 0"
      title="Your cart is empty"
      description="Browse the menu to add something delicious."
      action-label="Browse Menu"
      @action="router.push({ name: 'customer.menu' })"
    />

    <div v-else class="flex-1 space-y-3 px-5">
      <div
        v-for="item in cartStore.items"
        :key="item.productId"
        class="rounded-2xl border border-bz-border bg-white p-3"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-bz-ink-900">{{ item.name }}</p>
          <button
            type="button"
            class="text-xs text-bz-red underline underline-offset-2"
            @click="cartStore.removeItem(item.productId)"
          >
            Remove
          </button>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <div class="flex items-center gap-3 rounded-full bg-bz-cream px-3 py-1">
            <button
              type="button"
              class="h-6 w-6 rounded-full bg-white text-bz-ink-900 shadow-bz-sm"
              @click="cartStore.updateQuantity(item.productId, item.quantity - 1)"
            >
              -
            </button>
            <span class="w-4 text-center text-sm font-medium">{{ item.quantity }}</span>
            <button
              type="button"
              class="h-6 w-6 rounded-full bg-white text-bz-ink-900 shadow-bz-sm"
              @click="cartStore.updateQuantity(item.productId, item.quantity + 1)"
            >
              +
            </button>
          </div>
          <span class="text-sm font-semibold text-bz-gold-700">
            Rs. {{ (Number(item.price) * item.quantity).toFixed(2) }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="cartStore.items.length > 0"
      class="fixed inset-x-0 bottom-0 mx-auto max-w-md space-y-3 bg-white px-5 py-4 shadow-bz-lg"
    >
      <div class="flex items-center justify-between text-sm">
        <span class="text-bz-ink-500">Subtotal</span>
        <span class="font-semibold text-bz-ink-900">Rs. {{ cartStore.subtotal.toFixed(2) }}</span>
      </div>
      <button
        type="button"
        class="w-full rounded-full bg-bz-gold-600 py-3 text-sm font-medium text-white shadow-bz-sm"
        @click="router.push({ name: 'customer.checkout' })"
      >
        Proceed to Checkout
      </button>
    </div>
  </main>
</template>
