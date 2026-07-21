// frontend/tests/admin-customers-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as customersApi from "../src/api/staff-customers";
import CustomersView from "../src/views/admin/CustomersView.vue";
import type { SafeCustomer } from "../src/types/customer";

function makeCustomer(overrides: Partial<SafeCustomer> = {}): SafeCustomer {
  return {
    id: "c1",
    name: "Ali Khan",
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

describe("admin CustomersView", () => {
  it("loads and renders the customer list", async () => {
    vi.spyOn(customersApi, "searchCustomers").mockResolvedValue({ customers: [makeCustomer()] });

    const wrapper = mount(CustomersView);
    await flushPromises();

    expect(wrapper.text()).toContain("Ali Khan");
  });

  it("shows financial summary when a customer is expanded", async () => {
    vi.spyOn(customersApi, "searchCustomers").mockResolvedValue({ customers: [makeCustomer()] });
    vi.spyOn(customersApi, "getCustomerRecord").mockResolvedValue({
      customer: { ...makeCustomer(), summary: { orderCount: 3, unpaidOrderCount: 1, partiallyPaidOrderCount: 0, outstandingBalance: "75.00" } },
    });

    const wrapper = mount(CustomersView);
    await flushPromises();

    await wrapper.get('[data-test="expand-c1"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("75.00");
  });

  it("creates a new customer via the dialog", async () => {
    vi.spyOn(customersApi, "searchCustomers").mockResolvedValue({ customers: [] });
    const createSpy = vi
      .spyOn(customersApi, "createCustomerRecord")
      .mockResolvedValue({ customer: makeCustomer(), matchedByPhone: [] });

    const wrapper = mount(CustomersView);
    await flushPromises();

    await wrapper.get('[data-test="new-customer"]').trigger("click");
    await wrapper.get('[data-test="field-name"]').setValue("Ali Khan");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({ name: "Ali Khan" });
  });
});
