<script setup lang="ts">
import { onMounted, ref } from "vue";

import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { getSettings, updateSettings } from "../../api/settings";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const loading = ref(true);
const loadError = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);
const saved = ref(false);

const taxRatePercent = ref("");
const serviceChargePercent = ref("");

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const result = await getSettings();
    taxRatePercent.value = result.settings.taxRatePercent;
    serviceChargePercent.value = result.settings.serviceChargePercent;
  } catch (caught) {
    loadError.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  saving.value = true;
  saveError.value = null;
  saved.value = false;
  try {
    const result = await updateSettings({
      taxRatePercent: Number(taxRatePercent.value),
      serviceChargePercent: Number(serviceChargePercent.value),
    });
    taxRatePercent.value = result.settings.taxRatePercent;
    serviceChargePercent.value = result.settings.serviceChargePercent;
    saved.value = true;
  } catch (caught) {
    saveError.value = toUserSafeErrorMessage(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6">
    <h1 class="text-xl font-bold text-bz-ink-900">Café Settings</h1>

    <LoadingState v-if="loading" label="Loading settings..." />
    <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />

    <div v-else class="mt-4 space-y-4 rounded-2xl border border-bz-border bg-white p-4">
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Tax rate (%)</label>
        <input
          v-model="taxRatePercent"
          data-test="tax-rate"
          type="number"
          min="0"
          max="100"
          step="0.01"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Service charge (%)</label>
        <input
          v-model="serviceChargePercent"
          data-test="service-charge"
          type="number"
          min="0"
          max="100"
          step="0.01"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>

      <p v-if="saveError" class="rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">{{ saveError }}</p>
      <p v-if="saved" class="rounded-xl bg-bz-green-tint px-3 py-2 text-sm text-bz-green">Saved.</p>

      <button
        type="button"
        data-test="save"
        class="w-full rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? "Saving..." : "Save changes" }}
      </button>
    </div>
  </main>
</template>
