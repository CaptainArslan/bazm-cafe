<script setup lang="ts">
import { onMounted, ref } from "vue";

import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { deleteMedia, listMedia } from "../../api/media";
import type { MediaFolder, SafeMedia } from "../../types/media";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const FOLDERS: MediaFolder[] = ["general", "categories", "products", "staff", "customers"];

const activeFolder = ref<MediaFolder>("general");
const loading = ref(true);
const error = ref<string | null>(null);
const mediaList = ref<SafeMedia[]>([]);
const actionError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await listMedia(activeFolder.value);
    mediaList.value = result.media;
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function selectFolder(folder: MediaFolder): void {
  if (folder === activeFolder.value) return;
  activeFolder.value = folder;
  void load();
}

async function remove(media: SafeMedia): Promise<void> {
  actionError.value = null;
  try {
    await deleteMedia(media.path);
    await load();
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  }
}

function dismissActionError(): void {
  actionError.value = null;
}

onMounted(load);
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header>
      <h1 class="text-xl font-bold text-bz-ink-900">Media</h1>
    </header>

    <div class="mt-4 flex flex-wrap gap-2">
      <button
        v-for="folder in FOLDERS"
        :key="folder"
        type="button"
        :data-test="`folder-tab-${folder}`"
        class="rounded-full border px-3 py-1.5 text-sm font-medium capitalize"
        :class="
          folder === activeFolder
            ? 'border-bz-gold-600 bg-bz-gold-600 text-white'
            : 'border-bz-border text-bz-ink-700'
        "
        @click="selectFolder(folder)"
      >
        {{ folder }}
      </button>
    </div>

    <div v-if="actionError" class="mt-3 flex items-start justify-between gap-3 rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">
      <span>{{ actionError }}</span>
      <button type="button" data-test="dismiss-action-error" class="font-medium" @click="dismissActionError">Dismiss</button>
    </div>

    <LoadingState v-if="loading && mediaList.length === 0" label="Loading media..." />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <EmptyState
      v-else-if="mediaList.length === 0"
      class="mt-6"
      title="No media"
      description="Images uploaded from the entity forms will show up here."
    />

    <div v-else class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      <div v-for="item in mediaList" :key="item.path" class="rounded-2xl border border-bz-border bg-white p-3">
        <img :src="item.url" alt="" class="h-24 w-full rounded-xl object-cover" />
        <p class="mt-2 truncate text-xs text-bz-ink-500" :title="item.originalName">{{ item.originalName }}</p>
        <button
          type="button"
          data-test="delete-media"
          class="mt-2 w-full rounded-full border border-bz-red px-3 py-1.5 text-xs font-medium text-bz-red"
          @click="remove(item)"
        >
          Delete
        </button>
      </div>
    </div>
  </main>
</template>
