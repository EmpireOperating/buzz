import assert from "node:assert/strict";
import test from "node:test";

import { handleComposerClipboardFilePaste } from "./useNativeClipboardImagePaste.ts";

test("handleComposerClipboardFilePaste uploads an available DOM file", () => {
  const file = new File(["image"], "paste.png", { type: "image/png" });
  const uploaded = [];
  const event = {
    clipboardData: {
      files: [file],
      items: [{ kind: "file", getAsFile: () => file }],
      types: ["Files", "image/png"],
    },
    preventDefault() {
      throw new Error("DOM file paste should not need native fallback");
    },
  };

  assert.equal(
    handleComposerClipboardFilePaste(
      event,
      (value) => uploaded.push(value),
      () => {},
    ),
    true,
  );
  assert.deepEqual(uploaded, [file]);
});

test("handleComposerClipboardFilePaste leaves ordinary text paste alone", () => {
  const event = {
    clipboardData: {
      files: [],
      getData: (format) => (format === "text/plain" ? "hello" : ""),
      items: [{ kind: "string", getAsFile: () => null }],
      types: ["text/plain"],
    },
  };

  assert.equal(
    handleComposerClipboardFilePaste(
      event,
      () => {},
      () => {},
    ),
    false,
  );
});
