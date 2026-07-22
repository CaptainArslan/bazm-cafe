<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import ActionConfirmationDialog from "../../components/feedback/ActionConfirmationDialog.vue";
import AdminFormDialog from "../../components/feedback/AdminFormDialog.vue";
import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import ImageUploadField from "../../components/domain/ImageUploadField.vue";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  updateCategoryStatus,
} from "../../api/admin-categories";
import type { CreateCategoryInput, SafeCategory, UpdateCategoryInput } from "../../types/category";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const loading = ref(true);
const error = ref<string | null>(null);
const categoryList = ref<SafeCategory[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await listCategories();
    categoryList.value = result.categories;
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function replaceCategory(updated: SafeCategory): void {
  const index = categoryList.value.findIndex((entry) => entry.id === updated.id);
  if (index !== -1) categoryList.value[index] = updated;
}

onMounted(load);

// --- Create / edit dialog ---

const formDialogOpen = ref(false);
const editingCategoryId = ref<string | null>(null);
const formSaving = ref(false);
const formError = ref<string | null>(null);
const form = reactive({
  name: "",
  description: "",
  displayOrder: "",
  imagePath: null as string | null,
});

function openCreateDialog(): void {
  editingCategoryId.value = null;
  form.name = "";
  form.description = "";
  form.displayOrder = "";
  form.imagePath = null;
  formError.value = null;
  formDialogOpen.value = true;
}

function openEditDialog(category: SafeCategory): void {
  editingCategoryId.value = category.id;
  form.name = category.name;
  form.description = category.description ?? "";
  form.displayOrder = String(category.displayOrder);
  form.imagePath = category.imagePath;
  formError.value = null;
  formDialogOpen.value = true;
}

function closeFormDialog(): void {
  formDialogOpen.value = false;
}

function buildFormInput(): CreateCategoryInput & UpdateCategoryInput {
  const description = form.description.trim();
  const displayOrder = String(form.displayOrder).trim();
  return {
    name: form.name.trim(),
    ...(description ? { description } : {}),
    ...(form.imagePath ? { imagePath: form.imagePath } : {}),
    ...(displayOrder ? { displayOrder: Number(displayOrder) } : {}),
  };
}

async function saveForm(): Promise<void> {
  formSaving.value = true;
  formError.value = null;
  try {
    if (editingCategoryId.value) {
      const result = await updateCategory(editingCategoryId.value, buildFormInput());
      replaceCategory(result.category);
    } else {
      const result = await createCategory(buildFormInput());
      categoryList.value = [result.category, ...categoryList.value];
    }
    closeFormDialog();
  } catch (caught) {
    formError.value = toUserSafeErrorMessage(caught);
  } finally {
    formSaving.value = false;
  }
}

// --- Visibility toggle ---

async function toggleVisible(category: SafeCategory): Promise<void> {
  try {
    const result = await updateCategoryStatus(category.id, !category.isVisible);
    replaceCategory(result.category);
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  }
}

// --- Delete ---

const actionError = ref<string | null>(null);
const deleteTarget = ref<SafeCategory | null>(null);
const deleteSaving = ref(false);

function openDeleteDialog(category: SafeCategory): void {
  actionError.value = null;
  deleteTarget.value = category;
}

function closeDeleteDialog(): void {
  deleteTarget.value = null;
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return;
  const category = deleteTarget.value;
  deleteSaving.value = true;
  actionError.value = null;
  try {
    await deleteCategory(category.id);
    categoryList.value = categoryList.value.filter((entry) => entry.id !== category.id);
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
      <h1 class="text-xl font-bold text-bz-ink-900">Categories</h1>
      <button
        type="button"
        data-test="new-category"
        class="rounded-full bg-bz-gold-600 px-4 py-2 text-sm font-medium text-white shadow-bz-sm"
        @click="openCreateDialog"
      >
        + New Category
      </button>
    </header>

    <div v-if="actionError" class="mt-3 flex items-start justify-between gap-3 rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">
      <span>{{ actionError }}</span>
      <button type="button" data-test="dismiss-action-error" class="font-medium" @click="dismissActionError">Dismiss</button>
    </div>

    <LoadingState v-if="loading && categoryList.length === 0" label="Loading categories..." />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <EmptyState
      v-else-if="categoryList.length === 0"
      class="mt-6"
      title="No categories"
      description="Categories you add will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <div v-for="category in categoryList" :key="category.id" class="rounded-2xl border border-bz-border bg-white p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-bz-ink-900">{{ category.name }}</p>
            <p v-if="category.description" class="text-sm text-bz-ink-500">{{ category.description }}</p>
            <p class="text-sm text-bz-ink-500">Order {{ category.displayOrder }}</p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="category.isVisible ? 'bg-bz-green-tint text-bz-green' : 'bg-bz-red-tint text-bz-red'"
          >
            {{ category.isVisible ? "Visible" : "Hidden" }}
          </span>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="openEditDialog(category)"
          >
            Edit
          </button>
          <button
            type="button"
            :data-test="`toggle-visible-${category.id}`"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="toggleVisible(category)"
          >
            {{ category.isVisible ? "Hide" : "Show" }}
          </button>
          <button
            type="button"
            :data-test="`delete-${category.id}`"
            class="rounded-full border border-bz-red px-3 py-1.5 text-sm font-medium text-bz-red"
            @click="openDeleteDialog(category)"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <ActionConfirmationDialog
      :open="deleteTarget !== null"
      title="Delete Category"
      :description="`Delete &quot;${deleteTarget?.name}&quot;? This cannot be undone.`"
      confirm-label="Delete"
      destructive
      :confirming="deleteSaving"
      @confirm="confirmDelete"
      @cancel="closeDeleteDialog"
    />

    <AdminFormDialog
      :open="formDialogOpen"
      :title="editingCategoryId ? 'Edit Category' : 'New Category'"
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
        <label class="text-xs font-medium text-bz-ink-500">Description</label>
        <textarea
          v-model="form.description"
          data-test="field-description"
          rows="3"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        ></textarea>
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Display order</label>
        <input
          v-model="form.displayOrder"
          data-test="field-displayOrder"
          type="number"
          min="0"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <ImageUploadField v-model="form.imagePath" folder="categories" label="Image" />
    </AdminFormDialog>
  </main>
</template>
