import assert from "node:assert/strict";
import test from "node:test";

import {
  clipboardPngBytesToFile,
  handleClipboardImageReadError,
} from "./tauriMedia.ts";

test("clipboardPngBytesToFile preserves native PNG bytes as an uploadable file", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const file = clipboardPngBytesToFile(bytes.buffer);

  assert.equal(file.name, "clipboard-image.png");
  assert.equal(file.type, "image/png");
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [...bytes]);
});

test("clipboard image read treats only no-image as an expected miss", () => {
  assert.equal(
    handleClipboardImageReadError("clipboard image unavailable"),
    null,
  );
  const failure = new Error("main thread dispatch failed");
  assert.throws(
    () => handleClipboardImageReadError(failure),
    (error) => error === failure,
  );
});
