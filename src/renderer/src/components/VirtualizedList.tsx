import { useMemo, useState } from "react";
import { useRef } from "react";
import type { Key, ReactNode, UIEvent } from "react";
import {
  rendererNow,
  reportRendererTimingSince
} from "../hooks/useRenderTiming";

interface VirtualizedListProps<T> {
  ariaLabel: string;
  emptyState?: ReactNode;
  estimateRowHeight?: number;
  getKey: (item: T, index: number) => Key;
  items: T[];
  overscan?: number;
  performanceLabel?: string;
  renderRow: (item: T, index: number) => ReactNode;
  viewportHeight?: number;
}

export function VirtualizedList<T>({
  ariaLabel,
  emptyState,
  estimateRowHeight = 48,
  getKey,
  items,
  overscan = 4,
  performanceLabel,
  renderRow,
  viewportHeight = 320
}: VirtualizedListProps<T>): JSX.Element {
  const [scrollTop, setScrollTop] = useState(0);
  const lastScrollReportAt = useRef(0);

  const windowState = useMemo(() => {
    const visibleCount = Math.ceil(viewportHeight / estimateRowHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / estimateRowHeight) - overscan);
    const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

    return {
      endIndex,
      offsetY: startIndex * estimateRowHeight,
      startIndex,
      totalHeight: items.length * estimateRowHeight
    };
  }, [estimateRowHeight, items.length, overscan, scrollTop, viewportHeight]);

  function handleScroll(event: UIEvent<HTMLDivElement>): void {
    const startedAt = rendererNow();

    setScrollTop(event.currentTarget.scrollTop);

    if (performanceLabel && startedAt !== null && startedAt - lastScrollReportAt.current > 250) {
      lastScrollReportAt.current = startedAt;
      window.requestAnimationFrame(() => {
        reportRendererTimingSince(`${performanceLabel}.scroll`, startedAt, {
          itemCount: items.length,
          renderedCount: Math.max(0, windowState.endIndex - windowState.startIndex)
        });
      });
    }
  }

  if (items.length === 0) {
    return (
      <div className="grid place-items-center overflow-hidden" style={{ height: viewportHeight }}>
        {emptyState}
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className="overflow-auto"
      onScroll={handleScroll}
      role="list"
      style={{ height: viewportHeight }}
    >
      <div className="relative" style={{ height: windowState.totalHeight }}>
        <div
          className="absolute inset-x-0 top-0"
          style={{ transform: `translateY(${windowState.offsetY}px)` }}
        >
          {items.slice(windowState.startIndex, windowState.endIndex).map((item, visibleIndex) => {
            const index = windowState.startIndex + visibleIndex;

            return (
              <div key={getKey(item, index)} style={{ minHeight: estimateRowHeight }}>
                {renderRow(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
