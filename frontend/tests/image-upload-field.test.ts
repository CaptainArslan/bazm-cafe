import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImageUploadField from "../src/components/domain/ImageUploadField.vue";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

function selectFile(wrapper: ReturnType<typeof mount>, file: File): Promise<void> {
  const input = wrapper.find('[data-test="file-input"]');
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  return input.trigger("change");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageUploadField", () => {
  it("uploads a valid file and emits the returned path", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(201, {
        success: true,
        message: "ok",
        data: { media: { path: "/uploads/media/products/new.png", url: "/uploads/media/products/new.png" } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, { props: { modelValue: null, folder: "products" } });
    const file = new File(["content"], "photo.png", { type: "image/png" });
    await selectFile(wrapper, file);
    await flushPromises();

    expect(wrapper.emitted("update:modelValue")).toEqual([["/uploads/media/products/new.png"]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a file that is too large without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, { props: { modelValue: null, folder: "products" } });
    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
    await selectFile(wrapper, oversized);
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/5MB/);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("rejects a file with a disallowed type without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, { props: { modelValue: null, folder: "products" } });
    const badType = new File(["content"], "doc.pdf", { type: "application/pdf" });
    await selectFile(wrapper, badType);
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/JPEG, PNG, WebP, and GIF/);
  });

  it("deletes the previous image after a successful replace", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(201, {
          success: true,
          message: "ok",
          data: { media: { path: "/uploads/media/products/new.png", url: "/uploads/media/products/new.png" } },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, message: "deleted" }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, {
      props: { modelValue: "/uploads/media/products/old.png", folder: "products" },
    });
    const file = new File(["content"], "photo.png", { type: "image/png" });
    await selectFile(wrapper, file);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1];
    expect(deleteUrl).toContain("/media");
    expect(deleteInit.method).toBe("DELETE");
    expect(JSON.parse(deleteInit.body as string)).toEqual({ path: "/uploads/media/products/old.png" });
    expect(wrapper.emitted("update:modelValue")).toEqual([["/uploads/media/products/new.png"]]);
  });

  it("clicking Remove deletes the current image and emits null", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { success: true, message: "deleted" }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, {
      props: { modelValue: "/uploads/media/products/old.png", folder: "products" },
    });
    await wrapper.find('[data-test="remove"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("update:modelValue")).toEqual([[null]]);
  });

  it("shows an inline error and leaves modelValue untouched when the upload fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(400, { success: false, message: "Image must be 5MB or smaller.", error: { code: "MEDIA_TOO_LARGE" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, { props: { modelValue: null, folder: "products" } });
    const file = new File(["content"], "photo.png", { type: "image/png" });
    await selectFile(wrapper, file);
    await flushPromises();

    expect(wrapper.text()).toContain("Image must be 5MB or smaller.");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });
});
