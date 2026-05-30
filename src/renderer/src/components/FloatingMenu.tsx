import { useLayoutEffect, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "./primitives";

interface FloatingMenuPosition {
  left: number;
  maxHeight: number;
  top: number;
}

export function FloatingMenu({
  anchorRef,
  children,
  className,
  width = 256
}: {
  anchorRef: RefObject<HTMLElement>;
  children: ReactNode;
  className?: string;
  width?: number;
}): JSX.Element | null {
  const [position, setPosition] = useState<FloatingMenuPosition | null>(null);

  useLayoutEffect(() => {
    function updatePosition(): void {
      const anchor = anchorRef.current;

      if (!anchor) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const offset = 6;
      const margin = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const availableBelow = viewportHeight - rect.bottom - offset - margin;
      const availableAbove = rect.top - offset - margin;
      const below = availableBelow >= 220 || availableBelow >= availableAbove;
      const maxHeight = Math.max(160, below ? availableBelow : availableAbove);
      const top = below ? rect.bottom + offset : Math.max(margin, rect.top - offset - maxHeight);
      const left = Math.min(
        Math.max(margin, rect.right - width),
        Math.max(margin, viewportWidth - width - margin)
      );

      setPosition({ left, maxHeight, top });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, width]);

  if (!position) {
    return null;
  }

  const style: CSSProperties = {
    left: position.left,
    maxHeight: position.maxHeight,
    top: position.top,
    width
  };

  return createPortal(
    <div
      className={cx(
        "fixed z-[1000] overflow-y-auto rounded-hcbLg border border-border bg-bg-primary py-2 shadow-xl",
        className
      )}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
}
