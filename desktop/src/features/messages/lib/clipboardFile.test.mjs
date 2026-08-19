import assert from "node:assert/strict";
import test from "node:test";

import {
  firstClipboardFile,
  hasClipboardImageType,
  shouldReadNativeClipboardImage,
} from "./clipboardFile.ts";

const screenshot = { name: "screenshot.png", type: "image/png" };

test("firstClipboardFile returns the file exposed through clipboard items", () => {
  assert.equal(
    firstClipboardFile({
      files: [],
      items: [{ getAsFile: () => screenshot, kind: "file" }],
    }),
    screenshot,
  );
});

test("firstClipboardFile falls back to clipboard files when WebKit omits a file item", () => {
  assert.equal(
    firstClipboardFile({
      files: [screenshot],
      items: [{ getAsFile: () => null, kind: "string" }],
    }),
    screenshot,
  );
});

test("firstClipboardFile returns null when the clipboard has no file payload", () => {
  assert.equal(firstClipboardFile({ files: [], items: [] }), null);
});

test("hasClipboardImageType recognizes an image MIME type without a file payload", () => {
  assert.equal(
    hasClipboardImageType({ files: [], items: [], types: ["image/png"] }),
    true,
  );
});

test("hasClipboardImageType ignores non-image clipboard types", () => {
  assert.equal(
    hasClipboardImageType({ files: [], items: [], types: ["text/plain"] }),
    false,
  );
});

test("shouldReadNativeClipboardImage falls back when WebKit exposes no clipboard payload", () => {
  assert.equal(
    shouldReadNativeClipboardImage({
      files: [],
      getData: () => "",
      items: [],
      types: [],
    }),
    true,
  );
});

test("shouldReadNativeClipboardImage preserves custom non-image payloads", () => {
  assert.equal(
    shouldReadNativeClipboardImage({
      files: [],
      items: [{ kind: "string", getAsFile: () => null }],
      types: ["application/x-custom"],
    }),
    false,
  );
});

test("shouldReadNativeClipboardImage preserves ordinary text paste", () => {
  assert.equal(
    shouldReadNativeClipboardImage({
      files: [],
      getData: (type) => (type === "text/plain" ? "hello" : ""),
      items: [],
      types: ["text/plain"],
    }),
    false,
  );
});
