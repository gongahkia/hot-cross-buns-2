import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { cx } from "../../../../components/primitives";
import { handleActivationKeyDown } from "../../coreScreenShared";
import type { CalendarEventViewModel, CalendarMonthWeekViewModel } from "../../coreViewModels";
import { CalendarEventChip, CalendarOverflowChip, CalendarOverflowPopover } from "./CalendarEventChips";
import { calendarDateTitle, calendarMonthVisibleChipCount, visibleCalendarMonthWeeks } from "./calendarGrid";
import type { CalendarCreateSeed, CalendarTimelineAllDaySegment } from "./types";

const monthEventLaneHeight = 22;

function monthAllDaySegmentStyle(segment: CalendarTimelineAllDaySegment): CSSProperties {
  return {
    gridColumn: `${segment.startDayIndex + 1} / span ${segment.daySpan}`,
    gridRow: `${segment.laneIndex + 2}`
  };
}

function monthEventChipStyle(dayIndex: number, laneIndex: number): CSSProperties {
  return {
    gridColumn: `${dayIndex + 1}`,
    gridRow: `${laneIndex + 2}`
  };
}

function monthOverflowStyle(dayIndex: number): CSSProperties {
  return {
    gridColumn: `${dayIndex + 1}`,
    gridRow: `${calendarMonthVisibleChipCount + 2}`
  };
}

export function MonthView({
  weeks,
  onCreate,
  onOpen,
  visibleCalendarIds
}: {
  weeks: CalendarMonthWeekViewModel[];
  onCreate: (seed?: CalendarCreateSeed) => void;
  onOpen: (event: CalendarEventViewModel) => void;
  visibleCalendarIds: ReadonlySet<string>;
}): JSX.Element {
  const [activeOverflow, setActiveOverflow] = useState<{
    events: CalendarEventViewModel[];
    title: string;
  } | null>(null);
  const visibleWeeks = useMemo(
    () => visibleCalendarMonthWeeks(weeks, visibleCalendarIds),
    [weeks, visibleCalendarIds]
  );

  return (
    <div className="flex min-h-[680px] flex-col overflow-hidden rounded-hcbMd border border-border bg-bg-secondary" role="grid" aria-label="Calendar month view">
      <div className="grid grid-cols-7 border-b border-border bg-bg-primary/40 text-center text-[var(--text-xs)] font-semibold text-text-muted" role="row">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
          <div className="border-r border-border px-2 py-2 last:border-r-0" key={weekday} role="columnheader">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-rows-6" role="rowgroup">
        {visibleWeeks.map((week) => (
          <div
            className="grid border-b border-border last:border-b-0"
            key={week.id}
            role="row"
            style={{
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gridTemplateRows: `28px repeat(${calendarMonthVisibleChipCount}, ${monthEventLaneHeight}px) ${monthEventLaneHeight}px minmax(0, 1fr)`
            }}
          >
            {week.days.map(({ day, overflowCount, visibleEventChips }, dayIndex) => {
              const dayKey = day.id.slice("month-".length);

              return (
                <div
                  className={cx(
                    "relative z-0 min-h-[126px] border-r border-border bg-bg-tertiary px-2 py-1.5 text-left transition-colors duration-fast ease-hcb last:border-r-0 hover:bg-surface-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    day.isToday && "bg-surface-0 ring-1 ring-inset ring-accent",
                    day.isOutsideMonth && "opacity-50"
                  )}
                  key={day.id}
                  onClick={() => onCreate({ startsAt: `${dayKey}T00:00:00.000Z`, allDay: true })}
                  onKeyDown={(event) =>
                    handleActivationKeyDown(event, () =>
                      onCreate({ startsAt: `${dayKey}T00:00:00.000Z`, allDay: true })
                    )
                  }
                  role="gridcell"
                  style={{ gridColumn: `${dayIndex + 1}`, gridRow: "1 / -1" }}
                  tabIndex={0}
                >
                  <span className="sr-only">{day.weekday}</span>
                  <span className="text-[var(--text-sm)] font-semibold text-text-primary">{day.dateLabel}</span>
                </div>
              );
            })}
            {week.allDaySegments.map((segment) => (
              <div
                className="z-10 min-w-0 px-1.5"
                data-calendar-month-all-day-segment={segment.event.id}
                data-day-span={segment.daySpan}
                data-ends-after-range={segment.endsAfterRange}
                data-lane-index={segment.laneIndex}
                data-start-day-index={segment.startDayIndex}
                data-starts-before-range={segment.startsBeforeRange}
                key={segment.event.id}
                role="presentation"
                style={monthAllDaySegmentStyle(segment)}
              >
                <CalendarEventChip
                  className="h-full min-h-5 px-1.5 py-0.5 text-[11px]"
                  event={segment.event}
                  labelVariant="title"
                  onKeyDown={(keyEvent) => {
                    keyEvent.stopPropagation();
                    handleActivationKeyDown(keyEvent, () => onOpen(segment.event));
                  }}
                  onOpen={onOpen}
                />
              </div>
            ))}
            {week.days.flatMap(({ day, visibleEventChips }, dayIndex) =>
              visibleEventChips.map(({ event, laneIndex }) => (
                <div
                  className="z-10 min-w-0 px-1.5"
                  key={`${day.id}-${event.id}`}
                  role="presentation"
                  style={monthEventChipStyle(dayIndex, laneIndex)}
                >
                  <CalendarEventChip
                    className="h-full min-h-5 px-1.5 py-0.5 text-[11px]"
                    event={event}
                    labelVariant="title"
                    onKeyDown={(keyEvent) => {
                      keyEvent.stopPropagation();
                      handleActivationKeyDown(keyEvent, () => onOpen(event));
                    }}
                    onOpen={onOpen}
                  />
                </div>
              ))
            )}
            {week.days.map(({ day, overflowCount, overflowEvents }, dayIndex) =>
              overflowCount > 0 ? (
                <div
                  className="z-10 min-w-0 px-1.5"
                  key={`${day.id}-overflow`}
                  role="presentation"
                  style={monthOverflowStyle(dayIndex)}
                >
                  <CalendarOverflowChip
                    count={overflowCount}
                    onOpen={() =>
                      setActiveOverflow({
                        events: overflowEvents,
                        title: `More items for ${calendarDateTitle(day)}`
                      })
                    }
                  />
                </div>
              ) : null
            )}
          </div>
        ))}
      </div>
      {activeOverflow ? (
        <CalendarOverflowPopover
          events={activeOverflow.events}
          onClose={() => setActiveOverflow(null)}
          onOpen={onOpen}
          title={activeOverflow.title}
        />
      ) : null}
    </div>
  );
}
