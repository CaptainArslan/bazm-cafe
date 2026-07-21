import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import { MEDIA_UPLOADS_DIR } from "../../src/utils/storage.js";
import { listMediaInFolder } from "../../src/modules/media/media.service.js";

describe("listMediaInFolder", () => {
  it("returns an empty array for a folder with no uploads", async () => {
    const result = await listMediaInFolder("staff");
    assert.ok(Array.isArray(result));
  });

  it("returns SafeMedia entries for files that exist in the folder", async (t) => {
    const testFileName = `test-${Date.now()}.png`;
    const folderDir = path.join(MEDIA_UPLOADS_DIR, "general");
    await fs.promises.mkdir(folderDir, { recursive: true });
    await fs.promises.writeFile(path.join(folderDir, testFileName), "fake-image-content");

    t.after(() => fs.promises.unlink(path.join(folderDir, testFileName)).catch(() => {}));

    const result = await listMediaInFolder("general");
    const found = result.find((entry) => entry.originalName === testFileName);
    assert.ok(found, "expected the just-written test file to appear in the listing");
    assert.equal(found?.folder, "general");
    assert.equal(found?.mimeType, "image/png");
    assert.equal(found?.path, `/uploads/media/general/${testFileName}`);
  });

  it("propagates non-ENOENT errors instead of returning an empty array", async (t) => {
    // Create a file where the "products" folder directory is expected, so
    // readdir() fails with ENOTDIR rather than ENOENT.
    const productsDir = path.join(MEDIA_UPLOADS_DIR, "products");
    await fs.promises.rm(productsDir, { recursive: true, force: true });
    await fs.promises.mkdir(MEDIA_UPLOADS_DIR, { recursive: true });
    await fs.promises.writeFile(productsDir, "not-a-directory");

    t.after(async () => {
      await fs.promises.rm(productsDir, { force: true }).catch(() => {});
      await fs.promises.mkdir(productsDir, { recursive: true }).catch(() => {});
    });

    await assert.rejects(() => listMediaInFolder("products"));
  });
});
