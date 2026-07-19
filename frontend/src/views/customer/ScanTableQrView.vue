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

type ScanState =
  | "starting"
  | "scanning"
  | "denied"
  | "unsupported"
  | "insecure";

const state = ref<ScanState>("starting");
const errorDetail = ref("");

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
  await router.replace({
    name: "customer.dine-in-claim",
    params: { tableToken: token },
  });
}

async function requestCameraPermission(): Promise<boolean> {
  if (!window.isSecureContext) {
    state.value = "insecure";
    errorDetail.value =
      "Camera access requires HTTPS. On your PC run: npm run dev:lan — then open the https:// address shown in the terminal on your phone.";
    return false;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    state.value = "unsupported";
    errorDetail.value = "This browser cannot access the camera.";
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
      },
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      state.value = "denied";
      errorDetail.value =
        "Camera permission was blocked. Allow camera access for this site in your browser settings, then tap Try again.";
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      state.value = "unsupported";
      errorDetail.value = "No camera was found on this device.";
    } else if (name === "NotReadableError" || name === "TrackStartError") {
      state.value = "denied";
      errorDetail.value =
        "The camera is in use by another app. Close it and tap Try again.";
    } else {
      state.value = "denied";
      errorDetail.value =
        "Could not start the camera. Check browser permissions and try again.";
    }
    return false;
  }
}

async function startScanner() {
  state.value = "starting";
  errorDetail.value = "";
  handled = false;

  const allowed = await requestCameraPermission();
  if (!allowed) {
    return;
  }

  const hasCamera = await QrScanner.hasCamera();
  if (!hasCamera || !videoEl.value) {
    state.value = "unsupported";
    errorDetail.value = "No usable camera was found on this device.";
    return;
  }

  scanner?.stop();
  scanner?.destroy();
  scanner = new QrScanner(videoEl.value, handleResult, {
    returnDetailedScanResult: true,
    preferredCamera: "environment",
    highlightScanRegion: true,
    highlightCodeOutline: true,
  });

  try {
    await scanner.start();
    state.value = "scanning";
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    state.value =
      name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "denied"
        : "unsupported";
    errorDetail.value =
      "Camera started, then failed. Allow camera access and tap Try again.";
  }
}

onMounted(() => {
  void startScanner();
});

onBeforeUnmount(() => {
  scanner?.stop();
  scanner?.destroy();
  scanner = null;
});

function goBack() {
  router.push({ name: "customer.welcome" });
}

function goManual() {
  router.push({ name: "customer.welcome", query: { manual: "1" } });
}
</script>

<template>
  <main class="relative flex min-h-dvh flex-col bg-black text-white">
    <video
      ref="videoEl"
      class="h-full w-full object-cover"
      muted
      playsinline
      autoplay
    ></video>

    <div class="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-6">
      <button
        type="button"
        class="rounded-full bg-black/50 px-4 py-2 text-sm"
        @click="goBack"
      >
        Cancel
      </button>
    </div>

    <div
      v-if="state === 'starting'"
      class="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm"
    >
      Requesting camera permission...
    </div>

    <div
      v-else-if="state === 'insecure'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center"
    >
      <p class="text-base font-semibold">HTTPS required for camera</p>
      <p class="max-w-sm text-sm text-white/70">
        {{ errorDetail }}
      </p>
      <button
        type="button"
        class="mt-2 rounded-full bg-bz-gold-600 px-5 py-2 text-sm font-medium"
        @click="goManual"
      >
        Enter code manually
      </button>
    </div>

    <div
      v-else-if="state === 'denied'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center"
    >
      <p class="text-base font-semibold">Camera access needed</p>
      <p class="max-w-xs text-sm text-white/70">
        {{ errorDetail || "Allow camera access so you can scan the table QR code." }}
      </p>
      <div class="mt-2 flex flex-col gap-2">
        <button
          type="button"
          class="rounded-full bg-bz-gold-600 px-5 py-2 text-sm font-medium"
          @click="startScanner"
        >
          Try again
        </button>
        <button
          type="button"
          class="rounded-full bg-white/15 px-5 py-2 text-sm font-medium"
          @click="goManual"
        >
          Enter code manually
        </button>
      </div>
    </div>

    <div
      v-else-if="state === 'unsupported'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center"
    >
      <p class="text-base font-semibold">No camera available</p>
      <p class="max-w-xs text-sm text-white/70">
        {{ errorDetail || "Enter the table code manually instead." }}
      </p>
      <button
        type="button"
        class="mt-2 rounded-full bg-bz-gold-600 px-5 py-2 text-sm font-medium"
        @click="goManual"
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
