import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as mediaApi from "../src/api/media";
import MediaView from "../src/views/admin/MediaView.vue";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin MediaView", () => {
  it("loads media for the default folder and switches folders on tab click", async () => {
    const listSpy = vi.spyOn(mediaApi, "listMedia").mockResolvedValue({
      media: [{ path: "/uploads/media/general/a.png", url: "http://x/a.png", folder: "general", mimeType: "image/png", sizeBytes: 100, originalName: "a.png" }],
    });

    const wrapper = mount(MediaView);
    await flushPromises();

    expect(wrapper.text()).toContain("a.png");
    expect(listSpy).toHaveBeenCalledWith("general");

    await wrapper.get('[data-test="folder-tab-products"]').trigger("click");
    await flushPromises();

    expect(listSpy).toHaveBeenLastCalledWith("products");
  });

  it("opens a confirmation dialog before deleting a media item, and only deletes on confirm", async () => {
    vi.spyOn(mediaApi, "listMedia").mockResolvedValue({
      media: [{ path: "/uploads/media/general/a.png", url: "http://x/a.png", folder: "general", mimeType: "image/png", sizeBytes: 100, originalName: "a.png" }],
    });
    const deleteSpy = vi.spyOn(mediaApi, "deleteMedia").mockResolvedValue(undefined as never);

    const wrapper = mount(MediaView);
    await flushPromises();

    await wrapper.get('[data-test="delete-media"]').trigger("click");
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("a.png");

    await wrapper.get('[data-test="confirm"]').trigger("click");
    await flushPromises();

    expect(deleteSpy).toHaveBeenCalledWith("/uploads/media/general/a.png");
  });
});
