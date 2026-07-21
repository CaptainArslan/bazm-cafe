import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AdminFormDialog from "../src/components/feedback/AdminFormDialog.vue";

describe("AdminFormDialog", () => {
  it("renders the title, slot content, and emits save/cancel", async () => {
    const wrapper = mount(AdminFormDialog, {
      props: { open: true, title: "Edit Thing" },
      slots: { default: "<input data-test='field' />" },
    });

    expect(wrapper.text()).toContain("Edit Thing");
    expect(wrapper.find("[data-test='field']").exists()).toBe(true);

    await wrapper.find("button:last-of-type").trigger("click");
    expect(wrapper.emitted("save")).toHaveLength(1);

    await wrapper.find("button:first-of-type").trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("shows the error message and disables save while saving", () => {
    const wrapper = mount(AdminFormDialog, {
      props: { open: true, title: "Edit Thing", saving: true, error: "Something broke" },
    });

    expect(wrapper.text()).toContain("Something broke");
    expect(wrapper.text()).toContain("Saving...");
    expect(wrapper.find("button:last-of-type").attributes("disabled")).toBeDefined();
  });

  it("renders nothing when closed", () => {
    const wrapper = mount(AdminFormDialog, { props: { open: false, title: "Edit Thing" } });
    expect(wrapper.text()).not.toContain("Edit Thing");
  });
});
