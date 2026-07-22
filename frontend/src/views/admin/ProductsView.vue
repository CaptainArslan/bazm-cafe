<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import ActionConfirmationDialog from "../../components/feedback/ActionConfirmationDialog.vue";
import AdminFormDialog from "../../components/feedback/AdminFormDialog.vue";
import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import ImageUploadField from "../../components/domain/ImageUploadField.vue";
import { listCategories } from "../../api/admin-categories";
import {
  createProduct,
  deleteProduct,
  listAdminProducts,
  updateProduct,
  updateProductStatus,
} from "../../api/admin-products";
import type { CreateProductInput, UpdateProductInput } from "../../api/admin-products";
import type { SafeCategory } from "../../types/category";
import type { SafeProduct } from "../../types/product";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const loading = ref(true);
const error = ref<string | null>(null);
const productList = ref<SafeProduct[]>([]);
const categoryList = ref<SafeCategory[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [categoriesResult, productsResult] = await Promise.all([listCategories(), listAdminProducts()]);
    categoryList.value = categoriesResult.categories;
    productList.value = productsResult.products;
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

onMounted(load);

// --- Create / edit dialog ---

const formDialogOpen = ref(false);
const editingProductId = ref<string | null>(null);
const formSaving = ref(false);
const formError = ref<string | null>(null);
const form = reactive({
  categoryId: "",
  name: "",
  description: "",
  price: "",
  preparationMinutes: "",
  imagePath: null as string | null,
});

function openCreateDialog(): void {
  editingProductId.value = null;
  form.categoryId = categoryList.value[0]?.id ?? "";
  form.name = "";
  form.description = "";
  form.price = "";
  form.preparationMinutes = "";
  form.imagePath = null;
  formError.value = null;
  formDialogOpen.value = true;
}

function openEditDialog(product: SafeProduct): void {
  editingProductId.value = product.id;
  form.categoryId = product.categoryId;
  form.name = product.name;
  form.description = product.description ?? "";
  form.price = product.price;
  form.preparationMinutes = String(product.preparationMinutes);
  form.imagePath = product.imagePath;
  formError.value = null;
  formDialogOpen.value = true;
}

function closeFormDialog(): void {
  formDialogOpen.value = false;
}

function buildFormInput(): CreateProductInput & UpdateProductInput {
  const description = form.description.trim();
  const preparationMinutes = String(form.preparationMinutes).trim();
  return {
    categoryId: form.categoryId,
    name: form.name.trim(),
    price: Number(form.price),
    ...(description ? { description } : {}),
    ...(form.imagePath ? { imagePath: form.imagePath } : {}),
    ...(preparationMinutes ? { preparationMinutes: Number(preparationMinutes) } : {}),
  };
}

async function saveForm(): Promise<void> {
  formSaving.value = true;
  formError.value = null;
  try {
    if (editingProductId.value) {
      const result = await updateProduct(editingProductId.value, buildFormInput());
      replaceProduct(result.product);
    } else {
      const result = await createProduct(buildFormInput());
      productList.value = [result.product, ...productList.value];
    }
    closeFormDialog();
  } catch (caught) {
    formError.value = toUserSafeErrorMessage(caught);
  } finally {
    formSaving.value = false;
  }
}

// --- Availability toggle ---

async function toggleAvailable(product: SafeProduct): Promise<void> {
  try {
    const result = await updateProductStatus(product.id, !product.isAvailable);
    replaceProduct(result.product);
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  }
}

// --- Delete ---

const actionError = ref<string | null>(null);
const deleteTarget = ref<SafeProduct | null>(null);
const deleteSaving = ref(false);

function openDeleteDialog(product: SafeProduct): void {
  actionError.value = null;
  deleteTarget.value = product;
}

function closeDeleteDialog(): void {
  deleteTarget.value = null;
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return;
  const product = deleteTarget.value;
  deleteSaving.value = true;
  actionError.value = null;
  try {
    await deleteProduct(product.id);
    productList.value = productList.value.filter((entry) => entry.id !== product.id);
    closeDeleteDialog();
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
    closeDeleteDialog();
  } finally {
    deleteSaving.value = false;
  }
}

function dismissActionError(): void {
  actionError.value = null;
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-bz-ink-900">Products</h1>
      <button
        type="button"
        data-test="new-product"
        class="rounded-full bg-bz-gold-600 px-4 py-2 text-sm font-medium text-white shadow-bz-sm"
        @click="openCreateDialog"
      >
        + New Product
      </button>
    </header>

    <div v-if="actionError" class="mt-3 flex items-start justify-between gap-3 rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">
      <span>{{ actionError }}</span>
      <button type="button" data-test="dismiss-action-error" class="font-medium" @click="dismissActionError">Dismiss</button>
    </div>

    <LoadingState v-if="loading && productList.length === 0" label="Loading products..." />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <EmptyState
      v-else-if="productList.length === 0"
      class="mt-6"
      title="No products"
      description="Products you add will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <div v-for="product in productList" :key="product.id" class="rounded-2xl border border-bz-border bg-white p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-bz-ink-900">{{ product.name }}</p>
            <p class="text-sm text-bz-ink-500">{{ product.categoryName }}</p>
            <p class="text-sm text-bz-ink-500">{{ product.price }}</p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="product.isAvailable ? 'bg-bz-green-tint text-bz-green' : 'bg-bz-red-tint text-bz-red'"
          >
            {{ product.isAvailable ? "Available" : "Unavailable" }}
          </span>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="openEditDialog(product)"
          >
            Edit
          </button>
          <button
            type="button"
            :data-test="`toggle-available-${product.id}`"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="toggleAvailable(product)"
          >
            {{ product.isAvailable ? "Mark Unavailable" : "Mark Available" }}
          </button>
          <button
            type="button"
            :data-test="`delete-${product.id}`"
            class="rounded-full border border-bz-red px-3 py-1.5 text-sm font-medium text-bz-red"
            @click="openDeleteDialog(product)"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <ActionConfirmationDialog
      :open="deleteTarget !== null"
      title="Delete Product"
      :description="`Delete &quot;${deleteTarget?.name}&quot;? This cannot be undone.`"
      confirm-label="Delete"
      destructive
      :confirming="deleteSaving"
      @confirm="confirmDelete"
      @cancel="closeDeleteDialog"
    />

    <AdminFormDialog
      :open="formDialogOpen"
      :title="editingProductId ? 'Edit Product' : 'New Product'"
      :saving="formSaving"
      :error="formError"
      @save="saveForm"
      @cancel="closeFormDialog"
    >
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Name</label>
        <input
          v-model="form.name"
          data-test="field-name"
          type="text"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Category</label>
        <select
          v-model="form.categoryId"
          data-test="field-category"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        >
          <option v-for="category in categoryList" :key="category.id" :value="category.id">{{ category.name }}</option>
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Price</label>
        <input
          v-model="form.price"
          data-test="field-price"
          type="number"
          min="0"
          step="0.01"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Description</label>
        <textarea
          v-model="form.description"
          data-test="field-description"
          rows="3"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        ></textarea>
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Preparation minutes</label>
        <input
          v-model="form.preparationMinutes"
          data-test="field-preparationMinutes"
          type="number"
          min="0"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <ImageUploadField v-model="form.imagePath" folder="products" label="Image" />
    </AdminFormDialog>
  </main>
</template>
