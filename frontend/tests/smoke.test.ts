import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";

import App from "../src/App.vue";
import router from "../src/router";

describe("App", () => {
  it("mounts the customer welcome screen at /", async () => {
    setActivePinia(createPinia());

    await router.push("/");
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain("Welcome");
  });
});
