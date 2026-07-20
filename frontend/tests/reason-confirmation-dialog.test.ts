import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ReasonConfirmationDialog from "../src/components/feedback/ReasonConfirmationDialog.vue";

describe("ReasonConfirmationDialog", () => {
  it("disables confirm until the reason meets the minimum length", async () => {
    const wrapper = mount(ReasonConfirmationDialog, {
      props: {
        open: true,
        title: "Reject order",
        description: "Tell the customer why.",
      },
    });

    const confirmButton = wrapper.find("[data-test=confirm]");
    expect((confirmButton.element as HTMLButtonElement).disabled).toBe(true);

    await wrapper.find("textarea").setValue("ok");
    expect((wrapper.find("[data-test=confirm]").element as HTMLButtonElement).disabled).toBe(true);

    await wrapper.find("textarea").setValue("Kitchen is out of stock");
    expect((wrapper.find("[data-test=confirm]").element as HTMLButtonElement).disabled).toBe(false);
  });

  it("emits confirm with the trimmed reason", async () => {
    const wrapper = mount(ReasonConfirmationDialog, {
      props: { open: true, title: "Reject order", description: "Tell the customer why." },
    });

    await wrapper.find("textarea").setValue("  Kitchen is out of stock  ");
    await wrapper.find("[data-test=confirm]").trigger("click");

    expect(wrapper.emitted("confirm")).toEqual([["Kitchen is out of stock"]]);
  });

  it("emits cancel", async () => {
    const wrapper = mount(ReasonConfirmationDialog, {
      props: { open: true, title: "Reject order", description: "Tell the customer why." },
    });

    await wrapper.find("[data-test=cancel]").trigger("click");

    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });
});
