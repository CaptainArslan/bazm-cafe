<script setup lang="ts">
import QrScanner from "qr-scanner";
import workerUrl from "qr-scanner/qr-scanner-worker.min.js?url";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

QrScanner.WORKER_PATH = workerUrl;

const router = useRouter();
const videoEl = ref<HTMLVideoElement | null>(null);
let scanner: QrScanner | null = null;
let handled = false;

const state = ref<"starting" | "scanning" | "denied" | "unsupported">("starting");

function extractTableToken(raw: string): string | null {
  const trimmed = raw.trim();

  try {
    const url = new URL(trimmed);
    const match = /\/t\/([^/?#]+)/.exec(url.pathname);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // Not a URL — fall through and treat it as a raw token.
  }

  return trimmed.length >= 32 ? trimmed : null;
}

async function handleResult(result: { data: string }) {
  if (handled) {
    return;
  }

  const token = extractTableToken(result.data);
  if (!token) {
    return;
  }

  handled = true;
  scanner?.stop();
  await router.replace({ name: "customer.dine-in-claim", params: { tableToken: token } });
}

onMounted(async () => {
  const hasCamera = await QrScanner.hasCamera();
  if (!hasCamera || !videoEl.value) {
    state.value = "unsupported";
    return;
  }

  scanner = new QrScanner(videoEl.value, handleResult, {
    returnDetailedScanResult: true,
    preferredCamera: "environment",
    highlightScanRegion: true,
    highlightCodeOutline: true,
  });

  try {
    await scanner.start();
    state.value = "scanning";
  } catch {
    state.value = "denied";
  }
});

onBeforeUnmount(() => {
  scanner?.stop();
  scanner?.destroy();
  scanner = null;
});

function goBack() {
  router.push({ name: "customer.welcome" });
}
</script>

<template>
  <main class="relative flex min-h-dvh flex-col bg-black text-white">
    <video ref="videoEl" class="h-full w-full object-cover" muted playsinline></video>

    <div class="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-6">
      <button type="button" class="rounded-full bg-black/50 px-4 py-2 text-sm" @click="goBack">
        Cancel
      </button>
    </div>

    <div
      v-if="state === 'starting'"
      class="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm"
    >
      Starting camera...
    </div>

    <div
      v-else-if="state === 'denied'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center"
    >
      <p class="text-base font-semibold">Camera access needed</p>
      <p class="max-w-xs text-sm text-white/70">
        Allow camera access in your browser settings, or enter the table code manually instead.
      </p>
      <button
        type="button"
        class="mt-2 rounded-full bg-bz-gold-600 px-5 py-2 text-sm font-medium"
        @click="goBack"
      >
        Enter code manually
      </button>
    </div>

    <div
      v-else-if="state === 'unsupported'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center"
    >
      <p class="text-base font-semibold">No camera found</p>
      <p class="max-w-xs text-sm text-white/70">
        This device doesn't have a usable camera. Enter the table code manually instead.
      </p>
      <button
        type="button"
        class="mt-2 rounded-full bg-bz-gold-600 px-5 py-2 text-sm font-medium"
        @click="goBack"
      >
        Enter code manually
      </button>
    </div>

    <p
      v-else
      class="absolute inset-x-0 bottom-10 mx-auto w-fit rounded-full bg-black/50 px-4 py-2 text-xs"
    >
      Point your camera at the QR code on your table
    </p>
  </main>
</template>
