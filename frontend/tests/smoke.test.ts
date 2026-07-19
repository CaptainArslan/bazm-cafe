import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import App from "../src/App.vue";
import HomePlaceholder from "../src/views/customer/HomePlaceholder.vue";

describe("App", () => {
  it("mounts the customer placeholder at /", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", name: "customer.home", component: HomePlaceholder }],
    });

    router.push("/");
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.text()).toContain("Customer app");
  });
});
