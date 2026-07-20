import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteMedia, uploadMedia } from "../src/api/media";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("media api", () => {
  it("uploadMedia posts a FormData file to the folder-scoped endpoint and returns the media", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        success: true,
        message: "Image uploaded successfully.",
        data: {
          media: {
            path: "/uploads/media/products/abc.png",
            url: "/uploads/media/products/abc.png",
            folder: "products",
            mimeType: "image/png",
            sizeBytes: 1234,
            originalName: "photo.png",
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["content"], "photo.png", { type: "image/png" });
    const media = await uploadMedia(file, "products");

    expect(media.path).toBe("/uploads/media/products/abc.png");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/media?folder=products");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("deleteMedia sends the path in a DELETE request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, message: "Image deleted successfully." }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await deleteMedia("/uploads/media/products/abc.png");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/media");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ path: "/uploads/media/products/abc.png" });
  });
});
