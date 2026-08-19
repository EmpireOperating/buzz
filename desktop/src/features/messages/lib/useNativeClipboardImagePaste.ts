import * as React from "react";
import type { Editor } from "@tiptap/core";

import {
  firstClipboardFile,
  shouldReadNativeClipboardImage,
} from "@/features/messages/lib/clipboardFile";
import { subscribeToEditorDomEvent } from "@/features/messages/lib/tiptapViewMount";
import { readImageFromSystemClipboard } from "@/shared/api/tauriMedia";

type UploadFile = (file: File) => unknown;
type UploadFileRef = React.MutableRefObject<UploadFile>;
type SetUploadError = (state: { status: "error"; message: string }) => unknown;

const CLIPBOARD_READ_ERROR =
  "Could not read the image from the system clipboard.";

function uploadNativeClipboardImage(
  uploadFile: UploadFile,
  setUploadError: SetUploadError,
) {
  void readImageFromSystemClipboard()
    .then((nativeImage) => {
      if (nativeImage) void uploadFile(nativeImage);
    })
    .catch(() => {
      setUploadError({ status: "error", message: CLIPBOARD_READ_ERROR });
    });
}

export function handleComposerClipboardFilePaste(
  event: ClipboardEvent,
  uploadFile: UploadFile,
  setUploadError: SetUploadError,
): boolean {
  const mediaFile = firstClipboardFile(event.clipboardData);
  if (mediaFile) {
    void uploadFile(mediaFile);
    return true;
  }
  if (!shouldReadNativeClipboardImage(event.clipboardData)) return false;

  event.preventDefault();
  uploadNativeClipboardImage(uploadFile, setUploadError);
  return true;
}

export function useComposerClipboardImagePaste(
  editor: Editor | null,
  uploadFile: UploadFile,
  setUploadError: SetUploadError,
) {
  const uploadFileRef = React.useRef(uploadFile);
  uploadFileRef.current = uploadFile;
  useNativeClipboardImagePaste(editor, uploadFileRef, setUploadError);
  return React.useCallback(
    (event: ClipboardEvent) =>
      handleComposerClipboardFilePaste(
        event,
        uploadFileRef.current,
        setUploadError,
      ),
    [setUploadError],
  );
}

export function useNativeClipboardImagePaste(
  editor: Editor | null,
  uploadFileRef: UploadFileRef,
  setUploadError: SetUploadError,
) {
  React.useEffect(() => {
    if (!editor) return;
    const handlePaste = (event: ClipboardEvent) => {
      if (!shouldReadNativeClipboardImage(event.clipboardData)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      uploadNativeClipboardImage(uploadFileRef.current, setUploadError);
    };
    return subscribeToEditorDomEvent(
      editor,
      "paste",
      (event) => handlePaste(event as ClipboardEvent),
      true,
    );
  }, [editor, setUploadError, uploadFileRef]);
}
