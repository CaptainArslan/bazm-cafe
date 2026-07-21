<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import AdminFormDialog from "../../components/feedback/AdminFormDialog.vue";
import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { createStaff, listStaff, updateStaff, updateStaffPassword, updateStaffStatus } from "../../api/admin-staff";
import type { CreateStaffInput, SafeStaff, UpdateStaffInput } from "../../types/staff";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const loading = ref(true);
const error = ref<string | null>(null);
const staffList = ref<SafeStaff[]>([]);
const search = ref("");

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await listStaff({ search: search.value || undefined });
    staffList.value = result.staff;
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function onSearchInput(event: Event): void {
  search.value = (event.target as HTMLInputElement).value;
  void load();
}

onMounted(load);

// --- Create / edit dialog ---

const formDialogOpen = ref(false);
const editingStaffId = ref<string | null>(null);
const formSaving = ref(false);
const formError = ref<string | null>(null);
const form = reactive({ name: "", email: "", phone: "", password: "" });

function openCreateDialog(): void {
  editingStaffId.value = null;
  form.name = "";
  form.email = "";
  form.phone = "";
  form.password = "";
  formError.value = null;
  formDialogOpen.value = true;
}

function openEditDialog(member: SafeStaff): void {
  editingStaffId.value = member.id;
  form.name = member.name;
  form.email = member.email;
  form.phone = member.phone ?? "";
  form.password = "";
  formError.value = null;
  formDialogOpen.value = true;
}

function closeFormDialog(): void {
  formDialogOpen.value = false;
}

function buildCreateInput(): CreateStaffInput {
  const phone = form.phone.trim();
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
    ...(phone ? { phone } : {}),
  };
}

function buildUpdateInput(): UpdateStaffInput {
  const phone = form.phone.trim();
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: phone ? phone : null,
  };
}

async function saveForm(): Promise<void> {
  formSaving.value = true;
  formError.value = null;
  try {
    if (editingStaffId.value) {
      const result = await updateStaff(editingStaffId.value, buildUpdateInput());
      const index = staffList.value.findIndex((member) => member.id === editingStaffId.value);
      if (index !== -1) staffList.value[index] = result.staff;
    } else {
      const result = await createStaff(buildCreateInput());
      staffList.value = [result.staff, ...staffList.value];
    }
    closeFormDialog();
  } catch (caught) {
    formError.value = toUserSafeErrorMessage(caught);
  } finally {
    formSaving.value = false;
  }
}

// --- Active / inactive toggle ---

const actionError = ref<string | null>(null);

async function toggleActive(member: SafeStaff): Promise<void> {
  try {
    const result = await updateStaffStatus(member.id, !member.isActive);
    const index = staffList.value.findIndex((entry) => entry.id === member.id);
    if (index !== -1) staffList.value[index] = result.staff;
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  }
}

function dismissActionError(): void {
  actionError.value = null;
}

// --- Password reset dialog ---

const passwordDialogOpen = ref(false);
const passwordTargetId = ref<string | null>(null);
const passwordSaving = ref(false);
const passwordError = ref<string | null>(null);
const newPassword = ref("");

function openPasswordDialog(member: SafeStaff): void {
  passwordTargetId.value = member.id;
  newPassword.value = "";
  passwordError.value = null;
  passwordDialogOpen.value = true;
}

function closePasswordDialog(): void {
  passwordDialogOpen.value = false;
}

async function savePassword(): Promise<void> {
  if (!passwordTargetId.value) return;
  passwordSaving.value = true;
  passwordError.value = null;
  try {
    await updateStaffPassword(passwordTargetId.value, newPassword.value);
    closePasswordDialog();
  } catch (caught) {
    passwordError.value = toUserSafeErrorMessage(caught);
  } finally {
    passwordSaving.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-bz-ink-900">Staff</h1>
      <button
        type="button"
        data-test="new-staff"
        class="rounded-full bg-bz-gold-600 px-4 py-2 text-sm font-medium text-white shadow-bz-sm"
        @click="openCreateDialog"
      >
        + New Staff
      </button>
    </header>

    <input
      data-test="search"
      type="search"
      :value="search"
      placeholder="Search by name or email"
      class="mt-4 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      @input="onSearchInput"
    />

    <div v-if="actionError" class="mt-3 flex items-start justify-between gap-3 rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">
      <span>{{ actionError }}</span>
      <button type="button" data-test="dismiss-action-error" class="font-medium" @click="dismissActionError">Dismiss</button>
    </div>

    <LoadingState v-if="loading && staffList.length === 0" label="Loading staff..." />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <EmptyState
      v-else-if="staffList.length === 0"
      class="mt-6"
      title="No staff members"
      description="Staff you add will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <div v-for="member in staffList" :key="member.id" class="rounded-2xl border border-bz-border bg-white p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-bz-ink-900">{{ member.name }}</p>
            <p class="text-sm text-bz-ink-500">{{ member.email }}</p>
            <p v-if="member.phone" class="text-sm text-bz-ink-500">{{ member.phone }}</p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="member.isActive ? 'bg-bz-green-tint text-bz-green' : 'bg-bz-red-tint text-bz-red'"
          >
            {{ member.isActive ? "Active" : "Inactive" }}
          </span>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="openEditDialog(member)"
          >
            Edit
          </button>
          <button
            type="button"
            :data-test="`toggle-active-${member.id}`"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="toggleActive(member)"
          >
            {{ member.isActive ? "Deactivate" : "Activate" }}
          </button>
          <button
            type="button"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="openPasswordDialog(member)"
          >
            Reset Password
          </button>
        </div>
      </div>
    </div>

    <AdminFormDialog
      :open="formDialogOpen"
      :title="editingStaffId ? 'Edit Staff' : 'New Staff'"
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
        <label class="text-xs font-medium text-bz-ink-500">Email</label>
        <input
          v-model="form.email"
          data-test="field-email"
          type="email"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Phone</label>
        <input
          v-model="form.phone"
          data-test="field-phone"
          type="text"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <div v-if="!editingStaffId">
        <label class="text-xs font-medium text-bz-ink-500">Password</label>
        <input
          v-model="form.password"
          data-test="field-password"
          type="password"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
    </AdminFormDialog>

    <AdminFormDialog
      :open="passwordDialogOpen"
      title="Reset Password"
      save-label="Reset"
      :saving="passwordSaving"
      :error="passwordError"
      @save="savePassword"
      @cancel="closePasswordDialog"
    >
      <div>
        <label class="text-xs font-medium text-bz-ink-500">New password</label>
        <input
          v-model="newPassword"
          data-test="field-new-password"
          type="password"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
    </AdminFormDialog>
  </main>
</template>
