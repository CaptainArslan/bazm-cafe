<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import EmptyState from "../../components/feedback/EmptyState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import { useCartStore } from "../../stores/cart.store";
import { useMenuStore } from "../../stores/menu.store";

const menuStore = useMenuStore();
const cartStore = useCartStore();

const selectedCategoryId = ref<string | null>(null);

onMounted(async () => {
  if (!menuStore.loaded) {
    await menuStore.fetchMenu();
  }
  selectedCategoryId.value = menuStore.categories[0]?.id ?? null;
});

const visibleProducts = computed(() =>
  selectedCategoryId.value ? menuStore.productsByCategory(selectedCategoryId.value) : [],
);

function imageSrc(imagePath: string | null): string | null {
  return imagePath;
}
</script>

<template>
  <main class="flex min-h-dvh flex-col pb-24">
    <header class="sticky top-0 z-10 bg-bz-bg px-5 pt-6 pb-3">
      <p class="text-sm font-semibold tracking-widest text-bz-gold-700 uppercase">BAZM Café</p>
      <h1 class="mt-1 text-xl font-bold text-bz-ink-900">Menu</h1>
    </header>

    <LoadingState v-if="menuStore.loading" label="Loading menu..." />
    <ErrorState
      v-else-if="menuStore.error"
      message="We couldn't load the menu."
      @retry="menuStore.fetchMenu"
    />
    <EmptyState
      v-else-if="menuStore.categories.length === 0"
      title="No items available"
      description="The menu is empty right now. Please check back soon."
    />

    <template v-else>
      <nav class="flex gap-2 overflow-x-auto px-5 pb-3">
        <button
          v-for="category in menuStore.categories"
          :key="category.id"
          type="button"
          class="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium"
          :class="
            selectedCategoryId === category.id
              ? 'bg-bz-gold-600 text-white'
              : 'bg-bz-cream text-bz-ink-800'
          "
          @click="selectedCategoryId = category.id"
        >
          {{ category.name }}
        </button>
      </nav>

      <div class="grid grid-cols-2 gap-3 px-5">
        <RouterLink
          v-for="product in visibleProducts"
          :key="product.id"
          :to="{ name: 'customer.product-detail', params: { productId: product.id } }"
          class="rounded-2xl border border-bz-border bg-white p-3 shadow-bz-sm"
        >
          <div class="aspect-square overflow-hidden rounded-xl bg-bz-cream">
            <img
              v-if="imageSrc(product.imagePath)"
              :src="imageSrc(product.imagePath)!"
              :alt="product.name"
              class="h-full w-full object-cover"
            />
          </div>
          <p class="mt-2 line-clamp-1 text-sm font-medium text-bz-ink-900">
            {{ product.name }}
          </p>
          <div class="mt-1 flex items-center justify-between">
            <span class="text-sm font-semibold text-bz-gold-700">Rs. {{ product.price }}</span>
            <button
              type="button"
              class="rounded-full bg-bz-gold-600 px-2.5 py-1 text-xs font-medium text-white"
              @click.stop.prevent="cartStore.addItem(product)"
            >
              Add
            </button>
          </div>
        </RouterLink>
      </div>
    </template>

    <RouterLink
      v-if="cartStore.totalItems > 0"
      :to="{ name: 'customer.cart' }"
      class="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center justify-between bg-bz-gold-600 px-5 py-4 text-sm font-medium text-white shadow-bz-lg"
    >
      <span>{{ cartStore.totalItems }} item(s) in cart</span>
      <span>View Cart · Rs. {{ cartStore.subtotal.toFixed(2) }}</span>
    </RouterLink>
  </main>
</template>
