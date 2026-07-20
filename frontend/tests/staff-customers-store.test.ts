import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffCustomersApi from "../src/api/staff-customers";
import { useStaffCustomersStore } from "../src/stores/staff-customers.store";
import type { SafeCustomer } from "../src/types/customer";

function makeCustomer(overrides: Partial<SafeCustomer> = {}): SafeCustomer {
  return {
    id: "c1",
    name: "Ali",
    phone: "03001234567",
    imagePath: null,
    imageUrl: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("staff customers store", () => {
  it("search populates results", async () => {
    vi.spyOn(staffCustomersApi, "searchCustomers").mockResolvedValue({ customers: [makeCustomer()] });
    const store = useStaffCustomersStore();

    await store.search("ali");

    expect(store.results).toHaveLength(1);
    expect(store.results[0].name).toBe("Ali");
  });

  it("search with an empty/whitespace query clears results without calling the API", async () => {
    const searchSpy = vi.spyOn(staffCustomersApi, "searchCustomers").mockResolvedValue({ customers: [] });
    const store = useStaffCustomersStore();
    store.results = [makeCustomer()];

    await store.search("   ");

    expect(store.results).toHaveLength(0);
    expect(searchSpy).not.toHaveBeenCalled();
  });
});
