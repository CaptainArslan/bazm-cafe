<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import AdminFormDialog from "../../components/feedback/AdminFormDialog.vue";
import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { adjustProductStock, listAdminProducts } from "../../api/admin-products";
import type { SafeProduct } from "../../types/product";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const loading = ref(true);
const error = ref<string | null>(null);
const productList = ref<SafeProduct[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await listAdminProducts();
    productList.value = result.products;
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function replaceProduct(updated: SafeProduct): void {
  const index = productList.value.findIndex((entry) => entry.id === updated.id);
  if (index !== -1) productList.value[index] = updated;
}

function isLowStock(product: SafeProduct): boolean {
  return product.availableQuantity <= product.lowStockThreshold;
}

onMounted(load);

// --- Adjust stock dialog ---

const dialogOpen = ref(false);
const adjustingProductId = ref<string | null>(null);
const formSaving = ref(false);
const formError = ref<string | null>(null);
const form = reactive({
  delta: "",
  reason: "",
});

function openAdjustDialog(product: SafeProduct): void {
  adjustingProductId.value = product.id;
  form.delta = "";
  form.reason = "";
  formError.value = null;
  dialogOpen.value = true;
}

function closeDialog(): void {
  dialogOpen.value = false;
}

async function saveAdjustment(): Promise<void> {
  if (!adjustingProductId.value) return;
  formSaving.value = true;
  formError.value = null;
  try {
    const result = await adjustProductStock(adjustingProductId.value, {
      quantityDelta: Number(form.delta),
      reason: form.reason.trim(),
    });
    replaceProduct(result.product);
    closeDialog();
  } catch (caught) {
    formError.value = toUserSafeErrorMessage(caught);
  } finally {
    formSaving.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header>
      <h1 class="text-xl font-bold text-bz-ink-900">Stock</h1>
    </header>

    <LoadingState v-if="loading && productList.length === 0" label="Loading stock..." />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <EmptyState
      v-else-if="productList.length === 0"
      class="mt-6"
      title="No products"
      description="Products you add will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <div
        v-for="product in productList"
        :key="product.id"
        :data-test="`stock-row-${product.id}`"
        class="rounded-2xl border border-bz-border bg-white p-4"
        :class="isLowStock(product) ? 'border-bz-red bg-bz-red-tint text-bz-red' : ''"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold" :class="isLowStock(product) ? 'text-bz-red' : 'text-bz-ink-900'">{{ product.name }}</p>
            <p class="mt-1 text-sm">Stock: {{ product.stockQuantity }}</p>
            <p class="text-sm">Reserved: {{ product.reservedQuantity }}</p>
            <p class="text-sm">Available: {{ product.availableQuantity }}</p>
            <p class="text-sm">Low-stock threshold: {{ product.lowStockThreshold }}</p>
          </div>
          <button
            type="button"
            :data-test="`adjust-${product.id}`"
            class="shrink-0 rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="openAdjustDialog(product)"
          >
            Adjust
          </button>
        </div>
      </div>
    </div>

    <AdminFormDialog
      :open="dialogOpen"
      title="Adjust Stock"
      :saving="formSaving"
      :error="formError"
      @save="saveAdjustment"
      @cancel="closeDialog"
    >
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Delta (use a negative number to reduce stock)</label>
        <input
          v-model="form.delta"
          data-test="field-delta"
          type="number"
          step="1"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Reason</label>
        <textarea
          v-model="form.reason"
          data-test="field-reason"
          rows="3"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        ></textarea>
      </div>
    </AdminFormDialog>
  </main>
</template>
