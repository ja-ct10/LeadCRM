/**
 * TruncatedCellTooltip — Shows a tooltip on hover when cell text is actually truncated.
 *
 * Uses Radix Tooltip primitive (via ShadCN) with a 500ms delay.
 * Only shows the tooltip when scrollWidth > clientWidth (text is clipped).
 * Applied to DataGrid cells without custom cell renderers in `clip` view mode.
 */

'use client';

import React, { useRef, useState, useCallback } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

interface TruncatedCellTooltipProps {
  /** The text content to display and show in tooltip when truncated */
  content: string;
  /** Children to render inside the tooltip trigger */
  children: React.ReactNode;
  /** Class name for the trigger wrapper */
  className?: string;
}

export function TruncatedCellTooltip({
  content,
  children,
  className,
}: TruncatedCellTooltipProps): React.ReactElement {
  const [isTruncated, setIsTruncated] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const checkTruncation = useCallback(() => {
    const el = triggerRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, []);

  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={0}>
      <Tooltip open={isTruncated ? undefined : false}>
        <TooltipTrigger asChild>
          <div
            ref={triggerRef}
            className={className}
            onMouseEnter={checkTruncation}
          >
            {children}
          </div>
        </TooltipTrigger>
        {isTruncated && (
          <TooltipContent
            side="bottom"
            align="start"
            className="max-w-[320px] break-words"
          >
            {content}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
