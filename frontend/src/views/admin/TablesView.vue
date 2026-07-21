<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import AdminFormDialog from "../../components/feedback/AdminFormDialog.vue";
import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import ReasonConfirmationDialog from "../../components/feedback/ReasonConfirmationDialog.vue";
import { ApiError } from "../../api/http";
import {
  createTable,
  forceReleaseTable,
  listTables,
  regenerateTableQr,
  releaseTable,
  updateTable,
  updateTableStatus,
} from "../../api/admin-tables";
import type { CreateTableInput, SafeTable, UpdateTableInput } from "../../types/table";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const STATUS_BADGE_CLASSES: Record<SafeTable["status"], string> = {
  AVAILABLE: "bg-bz-green-tint text-bz-green",
  OCCUPIED: "bg-bz-amber-tint text-bz-ink-800",
  OUT_OF_SERVICE: "bg-bz-red-tint text-bz-red",
};

const loading = ref(true);
const error = ref<string | null>(null);
const tableList = ref<SafeTable[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await listTables();
    tableList.value = result.tables;
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function replaceTable(updated: SafeTable): void {
  const index = tableList.value.findIndex((entry) => entry.id === updated.id);
  if (index !== -1) tableList.value[index] = updated;
}

onMounted(load);

// --- Create / edit dialog ---

const formDialogOpen = ref(false);
const editingTableId = ref<string | null>(null);
const formSaving = ref(false);
const formError = ref<string | null>(null);
const form = reactive({ tableNumber: "", name: "", capacity: "" });

function openCreateDialog(): void {
  editingTableId.value = null;
  form.tableNumber = "";
  form.name = "";
  form.capacity = "";
  formError.value = null;
  formDialogOpen.value = true;
}

function openEditDialog(table: SafeTable): void {
  editingTableId.value = table.id;
  form.tableNumber = table.tableNumber;
  form.name = table.name ?? "";
  form.capacity = String(table.capacity);
  formError.value = null;
  formDialogOpen.value = true;
}

function closeFormDialog(): void {
  formDialogOpen.value = false;
}

function buildCreateInput(): CreateTableInput {
  const name = form.name.trim();
  const capacity = form.capacity.trim();
  return {
    tableNumber: form.tableNumber.trim(),
    ...(name ? { name } : {}),
    ...(capacity ? { capacity: Number(capacity) } : {}),
  };
}

function buildUpdateInput(): UpdateTableInput {
  const name = form.name.trim();
  const capacity = form.capacity.trim();
  return {
    tableNumber: form.tableNumber.trim(),
    ...(name ? { name } : {}),
    ...(capacity ? { capacity: Number(capacity) } : {}),
  };
}

async function saveForm(): Promise<void> {
  formSaving.value = true;
  formError.value = null;
  try {
    if (editingTableId.value) {
      const result = await updateTable(editingTableId.value, buildUpdateInput());
      replaceTable(result.table);
    } else {
      const result = await createTable(buildCreateInput());
      tableList.value = [result.table, ...tableList.value];
    }
    closeFormDialog();
  } catch (caught) {
    formError.value = toUserSafeErrorMessage(caught);
  } finally {
    formSaving.value = false;
  }
}

// --- Operational status toggle ---

async function toggleOperationalStatus(table: SafeTable): Promise<void> {
  try {
    const result = await updateTableStatus(table.id, {
      operationalStatus: table.operationalStatus === "AVAILABLE" ? "OUT_OF_SERVICE" : "AVAILABLE",
    });
    replaceTable(result.table);
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  }
}

// --- QR code panel ---

const expandedQrId = ref<string | null>(null);
const regenerating = ref(false);
const qrError = ref<string | null>(null);

function toggleQr(table: SafeTable): void {
  expandedQrId.value = expandedQrId.value === table.id ? null : table.id;
  qrError.value = null;
}

async function regenerateQr(table: SafeTable): Promise<void> {
  regenerating.value = true;
  qrError.value = null;
  try {
    const result = await regenerateTableQr(table.id);
    replaceTable(result.table);
  } catch (caught) {
    qrError.value = toUserSafeErrorMessage(caught);
  } finally {
    regenerating.value = false;
  }
}

// --- Release / force-release ---

const releasingId = ref<string | null>(null);
const releaseError = reactive(new Map<string, string>());
const releaseNotice = ref<string | null>(null);

async function release(table: SafeTable): Promise<void> {
  releasingId.value = table.id;
  releaseError.delete(table.id);
  try {
    const result = await releaseTable(table.id);
    replaceTable(result.table);
    releaseNotice.value = `Table ${result.table.tableNumber} released.`;
  } catch (caught) {
    if (caught instanceof ApiError && caught.code === "SESSION_NOT_RELEASABLE") {
      releaseError.set(table.id, caught.message);
    } else {
      releaseError.set(table.id, toUserSafeErrorMessage(caught));
    }
  } finally {
    releasingId.value = null;
  }
}

const forceReleaseTargetId = ref<string | null>(null);
const forceReleaseSaving = ref(false);
const forceReleaseError = ref<string | null>(null);

function openForceReleaseDialog(table: SafeTable): void {
  forceReleaseTargetId.value = table.id;
  forceReleaseError.value = null;
}

function closeForceReleaseDialog(): void {
  forceReleaseTargetId.value = null;
}

async function confirmForceRelease(reason: string): Promise<void> {
  if (!forceReleaseTargetId.value) return;
  forceReleaseSaving.value = true;
  forceReleaseError.value = null;
  try {
    const result = await forceReleaseTable(forceReleaseTargetId.value, reason);
    replaceTable(result.table);
    releaseError.delete(forceReleaseTargetId.value);
    releaseNotice.value = `Table ${result.table.tableNumber} force-released.`;
    closeForceReleaseDialog();
  } catch (caught) {
    forceReleaseError.value = toUserSafeErrorMessage(caught);
  } finally {
    forceReleaseSaving.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-bz-ink-900">Tables & QR</h1>
      <button
        type="button"
        data-test="new-table"
        class="rounded-full bg-bz-gold-600 px-4 py-2 text-sm font-medium text-white shadow-bz-sm"
        @click="openCreateDialog"
      >
        + New Table
      </button>
    </header>

    <p v-if="releaseNotice" class="mt-3 rounded-xl bg-bz-green-tint px-3 py-2 text-sm text-bz-green">
      {{ releaseNotice }}
    </p>

    <LoadingState v-if="loading && tableList.length === 0" label="Loading tables..." />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <EmptyState
      v-else-if="tableList.length === 0"
      class="mt-6"
      title="No tables"
      description="Tables you add will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <div v-for="table in tableList" :key="table.id" class="rounded-2xl border border-bz-border bg-white p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-bz-ink-900">{{ table.tableNumber }}</p>
            <p v-if="table.name" class="text-sm text-bz-ink-500">{{ table.name }}</p>
            <p class="text-sm text-bz-ink-500">Seats {{ table.capacity }}</p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="STATUS_BADGE_CLASSES[table.status]"
          >
            {{ table.status }}
          </span>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="openEditDialog(table)"
          >
            Edit
          </button>
          <button
            type="button"
            :data-test="`view-qr-${table.id}`"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="toggleQr(table)"
          >
            {{ expandedQrId === table.id ? "Hide QR" : "View QR" }}
          </button>
          <button
            type="button"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
            @click="toggleOperationalStatus(table)"
          >
            {{ table.operationalStatus === "AVAILABLE" ? "Take Out of Service" : "Mark Available" }}
          </button>
          <button
            v-if="table.status === 'OCCUPIED'"
            type="button"
            :data-test="`release-${table.id}`"
            class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700 disabled:opacity-60"
            :disabled="releasingId === table.id"
            @click="release(table)"
          >
            {{ releasingId === table.id ? "Releasing..." : "Release" }}
          </button>
          <button
            v-if="table.status === 'OCCUPIED'"
            type="button"
            :data-test="`force-release-${table.id}`"
            class="rounded-full border border-bz-red px-3 py-1.5 text-sm font-medium text-bz-red"
            @click="openForceReleaseDialog(table)"
          >
            Force Release
          </button>
        </div>

        <p v-if="releaseError.has(table.id)" class="mt-2 text-sm text-bz-red">{{ releaseError.get(table.id) }}</p>

        <div v-if="expandedQrId === table.id" class="mt-3 border-t border-bz-border pt-3">
          <img
            v-if="table.qrImageUrl"
            data-test="qr-image"
            :src="table.qrImageUrl"
            alt="Table QR code"
            class="h-32 w-32 rounded-xl border border-bz-border object-contain"
          />
          <p v-else class="text-sm text-bz-ink-500">No QR code has been generated yet.</p>
          <p v-if="qrError" class="mt-2 text-sm text-bz-red">{{ qrError }}</p>
          <button
            type="button"
            data-test="regenerate-qr"
            class="mt-2 rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700 disabled:opacity-60"
            :disabled="regenerating"
            @click="regenerateQr(table)"
          >
            {{ regenerating ? "Regenerating..." : "Regenerate" }}
          </button>
        </div>
      </div>
    </div>

    <AdminFormDialog
      :open="formDialogOpen"
      :title="editingTableId ? 'Edit Table' : 'New Table'"
      :saving="formSaving"
      :error="formError"
      @save="saveForm"
      @cancel="closeFormDialog"
    >
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Table number</label>
        <input
          v-model="form.tableNumber"
          data-test="field-tableNumber"
          type="text"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
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
        <label class="text-xs font-medium text-bz-ink-500">Capacity</label>
        <input
          v-model="form.capacity"
          data-test="field-capacity"
          type="number"
          min="1"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
    </AdminFormDialog>

    <ReasonConfirmationDialog
      :open="forceReleaseTargetId !== null"
      title="Force Release Table"
      description="This will close the guest session even if there are unsettled orders. Provide a reason for the record."
      confirm-label="Force Release"
      :confirming="forceReleaseSaving"
      @confirm="confirmForceRelease"
      @cancel="closeForceReleaseDialog"
    />
    <p v-if="forceReleaseError" class="mt-3 text-sm text-bz-red">{{ forceReleaseError }}</p>
  </main>
</template>
