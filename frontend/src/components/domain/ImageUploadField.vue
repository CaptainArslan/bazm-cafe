<!-- frontend/src/components/domain/ImageUploadField.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";

import { deleteMedia, uploadMedia } from "../../api/media";
import type { MediaFolder } from "../../types/media";
import { toUserSafeErrorMessage } from "../../utils/error-message";
import { resolveMediaUrl } from "../../utils/media-url";

const props = defineProps<{ modelValue: string | null; folder: MediaFolder; label?: string }>();
const emit = defineEmits<{ "update:modelValue": [path: string | null] }>();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

const uploading = ref(false);
const error = ref<string | null>(null);

const previewUrl = computed(() => resolveMediaUrl(props.modelValue));

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }

  error.value = null;

  if (!ALLOWED_TYPES.includes(file.type)) {
    error.value = "Only JPEG, PNG, WebP, and GIF images are allowed.";
    return;
  }
  if (file.size > MAX_BYTES) {
    error.value = "Image must be 5MB or smaller.";
    return;
  }

  const previousPath = props.modelValue;
  uploading.value = true;
  try {
    const media = await uploadMedia(file, props.folder);
    if (previousPath) {
      try {
        await deleteMedia(previousPath);
      } catch {
        // Best-effort cleanup of the replaced file; the new image is already attached.
      }
    }
    emit("update:modelValue", media.path);
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  } finally {
    uploading.value = false;
  }
}

async function onRemove(): Promise<void> {
  const currentPath = props.modelValue;
  if (!currentPath) {
    return;
  }
  try {
    await deleteMedia(currentPath);
  } catch {
    // Best-effort cleanup; the reference is cleared below regardless.
  }
  emit("update:modelValue", null);
}
</script>

<template>
  <div class="rounded-2xl border border-bz-border bg-white p-4">
    <label v-if="label" class="text-sm font-semibold text-bz-ink-900">{{ label }}</label>

    <div v-if="previewUrl" class="mt-2 flex items-center gap-3">
      <img :src="previewUrl" alt="" class="h-16 w-16 rounded-xl object-cover" />
      <button
        type="button"
        data-test="remove"
        class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
        @click="onRemove"
      >
        Remove
      </button>
    </div>

    <input
      type="file"
      data-test="file-input"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="mt-2 block w-full text-sm text-bz-ink-700"
      :disabled="uploading"
      @change="onFileChange"
    />

    <p v-if="uploading" class="mt-2 text-xs text-bz-ink-500">Uploading...</p>
    <p v-if="error" class="mt-2 text-xs text-bz-red">{{ error }}</p>
  </div>
</template>
