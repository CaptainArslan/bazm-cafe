import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ComingSoonView from "../src/views/admin/ComingSoonView.vue";

describe("ComingSoonView", () => {
  it("renders the given title and a coming soon message", () => {
    const wrapper = mount(ComingSoonView, { props: { title: "Staff" } });

    expect(wrapper.text()).toContain("Staff");
    expect(wrapper.text()).toContain("Coming soon");
  });
});
