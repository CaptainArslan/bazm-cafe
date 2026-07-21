<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import EmptyState from "../../components/feedback/EmptyState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { useCartStore } from "../../stores/cart.store";
import { useMenuStore } from "../../stores/menu.store";

const props = defineProps<{ productId: string }>();

const router = useRouter();
const menuStore = useMenuStore();
const cartStore = useCartStore();

const quantity = ref(1);
const notes = ref("");

onMounted(async () => {
  if (!menuStore.loaded) {
    await menuStore.fetchMenu();
  }
});

const product = computed(() => menuStore.findProduct(props.productId));

function addToCart() {
  if (!product.value) {
    return;
  }
  cartStore.addItem(product.value, quantity.value);
  if (notes.value.trim()) {
    cartStore.updateNotes(product.value.id, notes.value.trim());
  }
  router.push({ name: "customer.cart" });
}
</script>

<template>
  <LoadingState v-if="menuStore.loading && !menuStore.loaded" label="Loading item..." />

  <main v-else-if="product" class="flex min-h-dvh flex-col pb-28">
    <div class="aspect-video w-full overflow-hidden bg-bz-cream">
      <img
        v-if="product.imagePath"
        :src="product.imagePath"
        :alt="product.name"
        class="h-full w-full object-cover"
      />
    </div>

    <div class="flex-1 space-y-4 px-5 py-5">
      <div>
        <h1 class="text-xl font-bold text-bz-ink-900">{{ product.name }}</h1>
        <p class="mt-1 text-lg font-semibold text-bz-gold-700">Rs. {{ product.price }}</p>
        <p class="mt-1 text-xs text-bz-ink-500">{{ product.preparationMinutes }} min prep time</p>
      </div>

      <p v-if="product.description" class="text-sm text-bz-ink-700">{{ product.description }}</p>

      <div>
        <label class="text-xs font-medium text-bz-ink-500">Note for the kitchen (optional)</label>
        <textarea
          v-model="notes"
          rows="2"
          maxlength="500"
          class="mt-1 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
    </div>

    <div class="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center gap-3 bg-white px-5 py-4 shadow-bz-lg">
      <div class="flex items-center gap-3 rounded-full bg-bz-cream px-3 py-1.5">
        <button
          type="button"
          class="h-7 w-7 rounded-full bg-white text-bz-ink-900 shadow-bz-sm"
          @click="quantity = Math.max(1, quantity - 1)"
        >
          -
        </button>
        <span class="w-4 text-center text-sm font-medium">{{ quantity }}</span>
        <button
          type="button"
          class="h-7 w-7 rounded-full bg-white text-bz-ink-900 shadow-bz-sm"
          @click="quantity = Math.min(100, quantity + 1)"
        >
          +
        </button>
      </div>
      <button
        type="button"
        class="flex-1 rounded-full bg-bz-gold-600 py-3 text-sm font-medium text-white shadow-bz-sm"
        @click="addToCart"
      >
        Add to Cart
      </button>
    </div>
  </main>

  <EmptyState
    v-else
    title="Item not found"
    description="This item may no longer be available."
    action-label="Back to menu"
    @action="router.push({ name: 'customer.menu' })"
  />
</template>
