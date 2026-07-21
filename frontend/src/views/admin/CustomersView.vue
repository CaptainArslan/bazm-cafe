<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import AdminFormDialog from "../../components/feedback/AdminFormDialog.vue";
import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import {
  createCustomerRecord,
  getCustomerRecord,
  searchCustomers,
  updateCustomerRecord,
} from "../../api/staff-customers";
import type { CustomerDetail, SafeCustomer } from "../../types/customer";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const loading = ref(true);
const error = ref<string | null>(null);
const customerList = ref<SafeCustomer[]>([]);
const search = ref("");

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await searchCustomers({ search: search.value || undefined });
    customerList.value = result.customers;
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

// --- Expand / financial summary ---

const expandedId = ref<string | null>(null);
const expandedDetails = reactive(new Map<string, CustomerDetail>());
const expandingId = ref<string | null>(null);
const expandError = ref<string | null>(null);

async function toggleExpand(customer: SafeCustomer): Promise<void> {
  if (expandedId.value === customer.id) {
    expandedId.value = null;
    return;
  }
  expandedId.value = customer.id;
  expandError.value = null;
  if (expandedDetails.has(customer.id)) {
    return;
  }
  expandingId.value = customer.id;
  try {
    const result = await getCustomerRecord(customer.id);
    expandedDetails.set(customer.id, result.customer);
  } catch (caught) {
    expandError.value = toUserSafeErrorMessage(caught);
  } finally {
    expandingId.value = null;
  }
}

// --- Create / edit dialog ---

const formDialogOpen = ref(false);
const editingCustomerId = ref<string | null>(null);
const formSaving = ref(false);
const formError = ref<string | null>(null);
const duplicateWarning = ref<string | null>(null);
const form = reactive({ name: "", phone: "" });

function openCreateDialog(): void {
  editingCustomerId.value = null;
  form.name = "";
  form.phone = "";
  formError.value = null;
  duplicateWarning.value = null;
  formDialogOpen.value = true;
}

function openEditDialog(customer: SafeCustomer): void {
  editingCustomerId.value = customer.id;
  form.name = customer.name;
  form.phone = customer.phone ?? "";
  formError.value = null;
  duplicateWarning.value = null;
  formDialogOpen.value = true;
}

function closeFormDialog(): void {
  formDialogOpen.value = false;
}

async function saveForm(): Promise<void> {
  formSaving.value = true;
  formError.value = null;
  try {
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (editingCustomerId.value) {
      const result = await updateCustomerRecord(editingCustomerId.value, {
        name,
        phone: phone ? phone : null,
      });
      const index = customerList.value.findIndex((entry) => entry.id === editingCustomerId.value);
      if (index !== -1) customerList.value[index] = result.customer;
      expandedDetails.delete(result.customer.id);
      closeFormDialog();
    } else {
      const result = await createCustomerRecord({ name, ...(phone ? { phone } : {}) });
      customerList.value = [result.customer, ...customerList.value];
      if (result.matchedByPhone.length > 0) {
        duplicateWarning.value = `Possible duplicate of: ${result.matchedByPhone.map((match) => match.name).join(", ")}`;
      }
      closeFormDialog();
    }
  } catch (caught) {
    formError.value = toUserSafeErrorMessage(caught);
  } finally {
    formSaving.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-bz-ink-900">Customers</h1>
      <button
        type="button"
        data-test="new-customer"
        class="rounded-full bg-bz-gold-600 px-4 py-2 text-sm font-medium text-white shadow-bz-sm"
        @click="openCreateDialog"
      >
        + New Customer
      </button>
    </header>

    <p v-if="duplicateWarning" class="mt-3 rounded-xl bg-bz-gold-100 px-3 py-2 text-sm text-bz-ink-700">
      {{ duplicateWarning }}
    </p>

    <input
      data-test="search"
      type="search"
      :value="search"
      placeholder="Search by name or phone"
      class="mt-4 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      @input="onSearchInput"
    />

    <LoadingState v-if="loading && customerList.length === 0" label="Loading customers..." />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <EmptyState
      v-else-if="customerList.length === 0"
      class="mt-6"
      title="No customers"
      description="Customers you add will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <div v-for="customer in customerList" :key="customer.id" class="rounded-2xl border border-bz-border bg-white p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-bz-ink-900">{{ customer.name }}</p>
            <p v-if="customer.phone" class="text-sm text-bz-ink-500">{{ customer.phone }}</p>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="openEditDialog(customer)"
          >
            Edit
          </button>
          <button
            type="button"
            :data-test="`expand-${customer.id}`"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="toggleExpand(customer)"
          >
            {{ expandedId === customer.id ? "Collapse" : "Expand" }}
          </button>
        </div>

        <div v-if="expandedId === customer.id" class="mt-3 border-t border-bz-border pt-3">
          <p v-if="expandingId === customer.id" class="text-sm text-bz-ink-500">Loading summary...</p>
          <p v-else-if="expandError" class="text-sm text-bz-red">{{ expandError }}</p>
          <dl v-else-if="expandedDetails.has(customer.id)" class="grid grid-cols-2 gap-2 text-sm text-bz-ink-700">
            <div>
              <dt class="text-xs text-bz-ink-500">Orders</dt>
              <dd>{{ expandedDetails.get(customer.id)!.summary.orderCount }}</dd>
            </div>
            <div>
              <dt class="text-xs text-bz-ink-500">Unpaid orders</dt>
              <dd>{{ expandedDetails.get(customer.id)!.summary.unpaidOrderCount }}</dd>
            </div>
            <div>
              <dt class="text-xs text-bz-ink-500">Partially paid orders</dt>
              <dd>{{ expandedDetails.get(customer.id)!.summary.partiallyPaidOrderCount }}</dd>
            </div>
            <div>
              <dt class="text-xs text-bz-ink-500">Outstanding balance</dt>
              <dd>{{ expandedDetails.get(customer.id)!.summary.outstandingBalance }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <AdminFormDialog
      :open="formDialogOpen"
      :title="editingCustomerId ? 'Edit Customer' : 'New Customer'"
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
        <label class="text-xs font-medium text-bz-ink-500">Phone</label>
        <input
          v-model="form.phone"
          data-test="field-phone"
          type="text"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
    </AdminFormDialog>
  </main>
</template>
