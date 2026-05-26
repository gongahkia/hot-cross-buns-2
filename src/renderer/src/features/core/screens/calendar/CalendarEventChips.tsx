import type { CSSProperties, DragEvent, KeyboardEvent } from "react";
import { cx } from "../../../../components/primitives";
import type { CalendarEventViewModel } from "../../coreViewModels";

const calendarSourceTones = [
  {
    border: "border-l-accent",
    swatch: "bg-accent"
  },
  {
    border: "border-l-success",
    swatch: "bg-success"
  },
  {
    border: "border-l-warning",
    swatch: "bg-warning"
  },
  {
    border: "border-l-info",
    swatch: "bg-info"
  },
  {
    border: "border-l-danger",
    swatch: "bg-danger"
  }
] as const;

const calendarSourceToneCache = new Map<string, (typeof calendarSourceTones)[number]>();

export function calendarSourceTone(calendarId: string): (typeof calendarSourceTones)[number] {
  const cached = calendarSourceToneCache.get(calendarId);

  if (cached) {
    return cached;
  }

  let hash = 0;

  for (let index = 0; index < calendarId.length; index += 1) {
    hash = (hash * 31 + calendarId.charCodeAt(index)) >>> 0;
  }

  const tone = calendarSourceTones[hash % calendarSourceTones.length];
  calendarSourceToneCache.set(calendarId, tone);
  return tone;
}

export function normalizeCalendarColor(color: string | null | undefined): string | null {
  const normalized = color?.trim() ?? "";

  if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function calendarSourceColorStyle(color: string | null | undefined): CSSProperties | undefined {
  const normalized = normalizeCalendarColor(color);

  if (!normalized) {
    return undefined;
  }

  return { backgroundColor: normalized };
}

function calendarEventAccentStyle(color: string | null | undefined): CSSProperties | undefined {
  const normalized = normalizeCalendarColor(color);

  if (!normalized) {
    return undefined;
  }

  return {
    backgroundImage: `linear-gradient(90deg, ${hexToRgba(normalized, 0.1)} 0%, transparent 56%)`,
    borderLeftColor: normalized
  };
}

function hexToRgba(color: string, alpha: number): string {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function calendarEventLabel(
  event: CalendarEventViewModel,
  variant: "range" | "time" | "title"
): string {
  if (variant === "range") {
    return `${event.rangeLabel} ${event.title}`;
  }

  if (variant === "time") {
    return event.allDay ? event.title : `${event.timeLabel} ${event.title}`;
  }

  return event.title;
}

export function CalendarSourceSwatch({
  calendarId,
  color,
  className
}: {
  calendarId: string;
  color?: string | null;
  className?: string;
}): JSX.Element {
  const tone = calendarSourceTone(calendarId);
  const colorStyle = calendarSourceColorStyle(color);

  return (
    <span
      aria-hidden="true"
      className={cx("size-2.5 shrink-0 rounded-full", colorStyle ? undefined : tone.swatch, className)}
      style={colorStyle}
    />
  );
}

export function CalendarEventChip({
  className,
  draggable = false,
  event,
  labelVariant,
  onDragStart,
  onKeyDown,
  onOpen
}: {
  className?: string;
  draggable?: boolean;
  event: CalendarEventViewModel;
  labelVariant: "range" | "time" | "title";
  onDragStart?: (dragEvent: DragEvent<HTMLElement>) => void;
  onKeyDown?: (keyEvent: KeyboardEvent<HTMLElement>) => void;
  onOpen?: (event: CalendarEventViewModel) => void;
}): JSX.Element {
  const tone = calendarSourceTone(event.calendarId);
  const accentStyle = calendarEventAccentStyle(event.calendarBackgroundColor);
  const label = calendarEventLabel(event, labelVariant);

  return (
    <button
      aria-label={label}
      className={cx(
        "group flex min-h-6 w-full min-w-0 cursor-default items-center gap-1.5 rounded-hcbSm border border-border border-l-4 bg-surface-0 px-2 py-1 text-left text-[var(--text-xs)] text-text-secondary shadow-sm transition-colors duration-fast ease-hcb hover:bg-surface-1 hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        draggable && "cursor-grab active:cursor-grabbing",
        event.allDay && "bg-bg-secondary font-medium",
        accentStyle ? undefined : tone.border,
        className
      )}
      draggable={draggable}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onOpen?.(event);
      }}
      onDragStart={onDragStart}
      onKeyDown={onKeyDown}
      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
      style={accentStyle}
      title={`${label} - ${event.calendar}`}
      type="button"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {event.mutationState && event.mutationState !== "synced" ? (
        <span
          aria-hidden="true"
          className={cx(
            "shrink-0 rounded-hcbSm px-1 text-[10px] font-semibold",
            event.mutationState === "failed" ? "bg-danger text-bg-tertiary" : "bg-warning text-bg-tertiary"
          )}
        >
          {event.mutationState === "failed" ? "Failed" : "Queued"}
        </span>
      ) : null}
    </button>
  );
}

export function CalendarOverflowChip({ count }: { count: number }): JSX.Element {
  return (
    <span className="inline-flex min-h-5 max-w-full items-center truncate rounded-hcbSm border border-dashed border-border px-2 text-[var(--text-xs)] text-text-muted">
      {count} more
    </span>
  );
}

export function CalendarAllDayLane({
  dayLabel,
  events,
  onCreate,
  onOpen,
  visibleCount = 4
}: {
  dayLabel: string;
  events: CalendarEventViewModel[];
  onCreate?: () => void;
  onOpen: (event: CalendarEventViewModel) => void;
  visibleCount?: number;
}): JSX.Element {
  const visibleEvents = events.slice(0, visibleCount);
  const overflowCount = Math.max(0, events.length - visibleEvents.length);

  return (
    <div
      aria-label={`All-day events for ${dayLabel}`}
      className="grid min-h-10 grid-cols-[72px_minmax(0,1fr)] border-b border-border bg-bg-secondary"
      role="group"
    >
      <div className="border-r border-border px-2 py-2 text-[var(--text-xs)] font-medium text-text-muted">
        All day
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1 px-2 py-1.5">
        {visibleEvents.map((event) => (
          <div className="min-w-0 basis-[180px] grow" key={event.id}>
            <CalendarEventChip event={event} labelVariant="title" onOpen={onOpen} />
          </div>
        ))}
        {overflowCount > 0 ? <CalendarOverflowChip count={overflowCount} /> : null}
        {events.length === 0 && onCreate ? (
          <button
            className="min-h-7 rounded-hcbSm border border-dashed border-border px-2 text-left text-[var(--text-xs)] text-text-muted transition-colors duration-fast ease-hcb hover:bg-surface-0 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            data-action-id="calendar.create"
            onClick={onCreate}
            type="button"
          >
            Add all-day event
          </button>
        ) : null}
      </div>
    </div>
  );
}
