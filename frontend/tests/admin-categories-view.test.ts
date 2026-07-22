import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/api/http";
import * as categoriesApi from "../src/api/admin-categories";
import CategoriesView from "../src/views/admin/CategoriesView.vue";
import type { SafeCategory } from "../src/types/category";

function makeCategory(overrides: Partial<SafeCategory> = {}): SafeCategory {
  return {
    id: "cat1",
    name: "Drinks",
    slug: "drinks",
    description: null,
    imagePath: null,
    imageUrl: null,
    displayOrder: 0,
    isVisible: true,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin CategoriesView", () => {
  it("loads and renders the category list", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    const wrapper = mount(CategoriesView);
    await flushPromises();
    expect(wrapper.text()).toContain("Drinks");
  });

  it("creates a category via the dialog", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [] });
    const createSpy = vi.spyOn(categoriesApi, "createCategory").mockResolvedValue({ category: makeCategory() });

    const wrapper = mount(CategoriesView);
    await flushPromises();

    await wrapper.get('[data-test="new-category"]').trigger("click");
    await wrapper.get('[data-test="field-name"]').setValue("Drinks");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({ name: "Drinks" });
  });

  it("creates a category with a displayOrder value without throwing", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [] });
    const createSpy = vi
      .spyOn(categoriesApi, "createCategory")
      .mockResolvedValue({ category: makeCategory({ displayOrder: 3 }) });

    const wrapper = mount(CategoriesView);
    await flushPromises();

    await wrapper.get('[data-test="new-category"]').trigger("click");
    await wrapper.get('[data-test="field-name"]').setValue("Drinks");
    await wrapper.get('[data-test="field-displayOrder"]').setValue("3");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({ name: "Drinks", displayOrder: 3 });
    // Regression guard: a native <input type="number"> coerces v-model's bound value to a
    // number once the user types into it, so buildFormInput must not assume form.displayOrder
    // is always a string (form.displayOrder.trim() throws "trim is not a function" otherwise).
    expect(wrapper.find('[data-test="dialog-save"]').exists()).toBe(false);
  });

  it("toggles category visibility", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory({ isVisible: true })] });
    const statusSpy = vi
      .spyOn(categoriesApi, "updateCategoryStatus")
      .mockResolvedValue({ category: makeCategory({ isVisible: false }) });

    const wrapper = mount(CategoriesView);
    await flushPromises();

    await wrapper.get('[data-test="toggle-visible-cat1"]').trigger("click");
    await flushPromises();

    expect(statusSpy).toHaveBeenCalledWith("cat1", false);
  });

  it("surfaces the CATEGORY_HAS_PRODUCTS error plainly when delete is blocked", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    vi.spyOn(categoriesApi, "deleteCategory").mockRejectedValue(
      new ApiError(409, "This category still has products.", { code: "CATEGORY_HAS_PRODUCTS" }),
    );

    const wrapper = mount(CategoriesView);
    await flushPromises();

    await wrapper.get('[data-test="delete-cat1"]').trigger("click");
    await wrapper.get('[data-test="confirm"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("This category still has products.");
  });

  it("opens a confirmation dialog before deleting a category, and only deletes on confirm", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    const deleteSpy = vi.spyOn(categoriesApi, "deleteCategory").mockResolvedValue(undefined as never);

    const wrapper = mount(CategoriesView);
    await flushPromises();

    await wrapper.get('[data-test="delete-cat1"]').trigger("click");
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Drinks");

    await wrapper.get('[data-test="confirm"]').trigger("click");
    await flushPromises();

    expect(deleteSpy).toHaveBeenCalledWith("cat1");
  });
});
