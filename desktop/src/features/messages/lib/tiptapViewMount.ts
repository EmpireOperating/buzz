type EditorWithView = {
  view: {
    dom: EventTarget;
  };
};

type AnimationFrameScheduler = {
  cancelAnimationFrame(handle: number): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
};

/**
 * Attach a DOM listener after Tiptap has mounted its EditorView.
 *
 * Tiptap creates the Editor before EditorContent mounts its ProseMirror view.
 * Accessing `editor.view` in that gap throws, so retry on the next frame rather
 * than letting a composer effect crash the application.
 */
export function subscribeToEditorDomEvent(
  editor: EditorWithView,
  eventType: string,
  listener: EventListener,
  capture: boolean,
  scheduler: AnimationFrameScheduler = window,
): () => void {
  let attachedDom: EventTarget | null = null;
  let cancelled = false;
  let frame = 0;

  const attach = () => {
    frame = 0;
    if (cancelled || attachedDom) return;

    try {
      attachedDom = editor.view.dom;
      attachedDom.addEventListener(eventType, listener, capture);
    } catch {
      if (!cancelled) frame = scheduler.requestAnimationFrame(attach);
    }
  };

  attach();

  return () => {
    cancelled = true;
    if (frame) scheduler.cancelAnimationFrame(frame);
    attachedDom?.removeEventListener(eventType, listener, capture);
  };
}
