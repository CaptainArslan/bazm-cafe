<script setup lang="ts">
import { onMounted, ref } from "vue";

import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { getSettings } from "../../api/settings";
import type { CafeSettings } from "../../types/settings";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const settings = ref<CafeSettings | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const result = await getSettings();
    settings.value = result.settings;
  } catch (caught) {
    loadError.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6">
    <h1 class="text-xl font-bold text-bz-ink-900">Café Settings</h1>

    <LoadingState v-if="loading" label="Loading settings..." />
    <ErrorState v-else-if="loadError || !settings" :message="loadError ?? 'Could not load settings.'" @retry="load" />

    <div v-else class="mt-4 space-y-3 rounded-2xl border border-bz-border bg-white p-4">
      <div class="flex justify-between text-sm">
        <span class="text-bz-ink-500">Tax rate</span>
        <span class="font-medium text-bz-ink-900">{{ settings.taxRatePercent }}%</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-bz-ink-500">Service charge</span>
        <span class="font-medium text-bz-ink-900">{{ settings.serviceChargePercent }}%</span>
      </div>
    </div>
  </main>
</template>
