import assert from "node:assert/strict";
import test from "node:test";

import { subscribeToEditorDomEvent } from "./tiptapViewMount.ts";

test("subscribeToEditorDomEvent waits for a Tiptap view that is not mounted yet", () => {
  const listeners = new Map();
  const dom = {
    addEventListener(type, listener, capture) {
      listeners.set(type, { listener, capture });
    },
    removeEventListener(type, listener, capture) {
      const current = listeners.get(type);
      if (current?.listener === listener && current.capture === capture) {
        listeners.delete(type);
      }
    },
  };
  let accessCount = 0;
  const editor = {
    get view() {
      accessCount += 1;
      if (accessCount === 1) {
        throw new Error("The editor view is not available");
      }
      return { dom };
    },
  };
  let scheduled;
  const handler = () => {};

  const dispose = subscribeToEditorDomEvent(editor, "paste", handler, true, {
    cancelAnimationFrame: () => {},
    requestAnimationFrame: (callback) => {
      scheduled = callback;
      return 1;
    },
  });

  assert.equal(listeners.size, 0);
  assert.equal(typeof scheduled, "function");
  scheduled();
  assert.deepEqual(listeners.get("paste"), {
    capture: true,
    listener: handler,
  });

  dispose();
  assert.equal(listeners.size, 0);
});
