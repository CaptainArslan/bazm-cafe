import { defineStore } from "pinia";
import { ref } from "vue";

export type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

const DEDUPE_WINDOW_MS = 3000;
const AUTO_DISMISS_MS = 5000;

export const useToastStore = defineStore("toast", () => {
  const toasts = ref<ToastItem[]>([]);
  let nextId = 1;
  let lastPush: { type: ToastType; message: string; at: number } | null = null;

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function push(type: ToastType, message: string): void {
    const now = Date.now();
    if (lastPush && lastPush.type === type && lastPush.message === message && now - lastPush.at < DEDUPE_WINDOW_MS) {
      return;
    }
    lastPush = { type, message, at: now };

    const id = nextId++;
    toasts.value = [...toasts.value, { id, type, message }];
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }

  return { toasts, push, dismiss };
});
