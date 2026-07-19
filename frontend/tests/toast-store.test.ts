// frontend/tests/toast-store.test.ts
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "../src/stores/toast.store";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toast store", () => {
  it("pushes a toast with a generated id", () => {
    const store = useToastStore();
    store.push("success", "Payment recorded.");
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].message).toBe("Payment recorded.");
    expect(store.toasts[0].type).toBe("success");
  });

  it("dedupes an identical type+message within 3 seconds", () => {
    const store = useToastStore();
    store.push("error", "Network error, please retry.");
    store.push("error", "Network error, please retry.");
    expect(store.toasts).toHaveLength(1);
  });

  it("allows the same message again after the dedupe window passes", () => {
    const store = useToastStore();
    store.push("error", "Network error, please retry.");
    vi.advanceTimersByTime(3001);
    store.push("error", "Network error, please retry.");
    expect(store.toasts).toHaveLength(2);
  });

  it("dismiss removes a toast by id", () => {
    const store = useToastStore();
    store.push("info", "Reconnected.");
    const id = store.toasts[0].id;
    store.dismiss(id);
    expect(store.toasts).toHaveLength(0);
  });

  it("auto-dismisses a toast after 5 seconds", () => {
    const store = useToastStore();
    store.push("success", "Saved.");
    expect(store.toasts).toHaveLength(1);
    vi.advanceTimersByTime(5001);
    expect(store.toasts).toHaveLength(0);
  });
});
