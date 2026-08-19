import type * as React from "react";
import { Pin } from "lucide-react";

import {
  makeThreadRailPin,
  useThreadRailContext,
} from "@/features/channels/ThreadRailContext";
import type { TimelineMessage } from "@/features/messages/types";
import {
  AuxiliaryPanelHeaderGroup,
  AuxiliaryPanelTitle,
} from "@/shared/layout/AuxiliaryPanel";
import { Button } from "@/shared/ui/button";

export function MessageThreadPanelHeader({
  channelId,
  channelName,
  expandedReplyIds,
  headerLeading,
  isFocusMode,
  isSinglePanelView,
  onClose,
  returnAnchorId,
  threadHead,
}: {
  channelId: string | null;
  channelName: string;
  expandedReplyIds: ReadonlySet<string>;
  headerLeading: React.ReactNode;
  isFocusMode: boolean;
  isSinglePanelView: boolean;
  onClose: () => void;
  returnAnchorId: string | undefined;
  threadHead: TimelineMessage;
}) {
  const threadRail = useThreadRailContext();
  const isPinned =
    channelId !== null &&
    threadRail.pins.some(
      (pin) => pin.channelId === channelId && pin.rootId === threadHead.id,
    );

  return (
    <AuxiliaryPanelHeaderGroup
      backButtonAriaLabel="Back to conversation"
      backButtonTestId="message-thread-back"
      leading={headerLeading}
      onBack={isSinglePanelView && !isFocusMode ? onClose : undefined}
    >
      <AuxiliaryPanelTitle>Thread</AuxiliaryPanelTitle>
      {threadRail.isScoped && channelId ? (
        <Button
          aria-label={isPinned ? "Thread pinned" : "Pin to thread rail"}
          aria-pressed={isPinned}
          data-testid="pin-thread-to-rail"
          disabled={isPinned}
          onClick={() =>
            threadRail.pin(
              makeThreadRailPin({
                channelId,
                channelName,
                rootExcerpt: threadHead.body.slice(0, 96),
                rootId: threadHead.id,
                returnAnchorId: returnAnchorId ?? undefined,
                expandedReplyIds: [...expandedReplyIds],
              }),
            )
          }
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Pin aria-hidden />
        </Button>
      ) : null}
    </AuxiliaryPanelHeaderGroup>
  );
}
