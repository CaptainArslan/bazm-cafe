// frontend/tests/staff-socket-store.test.ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/socket/client", () => {
  const handlers: Record<string, Array<() => void>> = {};
  const socket = {
    on: vi.fn((event: string, handler: () => void) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(handler);
    }),
    __emit: (event: string) => {
      (handlers[event] ?? []).forEach((handler) => handler());
    },
  };
  return {
    getSocket: vi.fn(() => socket),
    connectSocket: vi.fn(() => socket),
    disconnectSocket: vi.fn(),
  };
});

import { getSocket } from "../src/socket/client";
import { useStaffOrdersStore } from "../src/stores/staff-orders.store";
import { useStaffSocketStore } from "../src/stores/staff-socket.store";
import { SOCKET_EVENTS } from "../src/constants/socket-events";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe("staff socket store", () => {
  it("refetches the current filters when an order event arrives", () => {
    const staffOrdersStore = useStaffOrdersStore();
    const refetchSpy = vi.spyOn(staffOrdersStore, "refetchCurrentFilters").mockResolvedValue();
    const staffSocketStore = useStaffSocketStore();

    staffSocketStore.init();
    const socket = getSocket() as unknown as { __emit: (event: string) => void };
    socket.__emit(SOCKET_EVENTS.ORDER_STATUS_UPDATED);

    expect(refetchSpy).toHaveBeenCalled();
  });

  it("init is idempotent — calling it twice registers listeners once", () => {
    const staffSocketStore = useStaffSocketStore();
    staffSocketStore.init();
    staffSocketStore.init();

    const socket = getSocket() as unknown as { on: ReturnType<typeof vi.fn> };
    const orderCreatedCalls = socket.on.mock.calls.filter(
      ([event]) => event === SOCKET_EVENTS.ORDER_CREATED,
    );
    expect(orderCreatedCalls).toHaveLength(1);
  });

  it("sets connected to true/false on socket connect/disconnect events", () => {
    const staffSocketStore = useStaffSocketStore();
    staffSocketStore.init();
    const socket = getSocket() as unknown as { __emit: (event: string) => void };

    socket.__emit("connect");
    expect(staffSocketStore.connected).toBe(true);

    socket.__emit("disconnect");
    expect(staffSocketStore.connected).toBe(false);
  });
});
