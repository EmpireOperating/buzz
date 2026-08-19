type ClipboardFileItem = {
  getAsFile(): File | null;
  kind: string;
};

type ClipboardFileSource = {
  files?: Iterable<File> | null;
  getData?(format: string): string;
  items?: Iterable<ClipboardFileItem> | null;
  types?: Iterable<string> | null;
};

/**
 * Return a real file payload from a paste event.
 *
 * Chromium commonly exposes screenshot pastes through `items`; WebKit can
 * expose the same `image/png` clipboard payload only through `files`.
 */
export function firstClipboardFile(
  clipboardData: ClipboardFileSource | null | undefined,
): File | null {
  if (!clipboardData) return null;
  for (const item of clipboardData.items ?? []) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  for (const file of clipboardData.files ?? []) {
    if (file) return file;
  }
  return null;
}

/**
 * WebKitGTK can advertise a screenshot MIME type while exposing no DOM File.
 * The caller can use this signal to ask the native Tauri clipboard instead.
 */
export function hasClipboardImageType(
  clipboardData: ClipboardFileSource | null | undefined,
): boolean {
  if (!clipboardData) return false;
  for (const type of clipboardData.types ?? []) {
    if (type.toLowerCase().startsWith("image/")) return true;
  }
  return false;
}

/**
 * Whether paste should use the native image bridge.
 *
 * Some WebKitGTK/Wayland combinations expose an image clipboard as an empty
 * DataTransfer: no File and no image MIME type. An empty browser payload has
 * no useful default paste behavior, so it is safe to ask the native clipboard
 * for pixels. Non-empty text/HTML remains on the normal editor paste path.
 */
export function shouldReadNativeClipboardImage(
  clipboardData: ClipboardFileSource | null | undefined,
): boolean {
  if (!clipboardData || firstClipboardFile(clipboardData)) return false;
  if (hasClipboardImageType(clipboardData)) return true;
  const plainText = clipboardData.getData?.("text/plain") ?? "";
  const html = clipboardData.getData?.("text/html") ?? "";
  if (plainText.length > 0 || html.length > 0) return false;
  return (
    Array.from(clipboardData.types ?? []).length === 0 &&
    Array.from(clipboardData.items ?? []).length === 0 &&
    Array.from(clipboardData.files ?? []).length === 0
  );
}
