import { useMemo } from "react";
import { cx } from "../../../../components/primitives";
import { handleActivationKeyDown } from "../../coreScreenShared";
import type { CalendarEventViewModel, CalendarMonthWeekViewModel } from "../../coreViewModels";
import { CalendarEventChip, CalendarOverflowChip } from "./CalendarEventChips";
import { visibleCalendarMonthWeeks } from "./calendarGrid";
import type { CalendarCreateSeed } from "./types";

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
          <div className="grid grid-cols-7 border-b border-border last:border-b-0" key={week.id} role="row">
            {week.days.map(({ day, overflowCount, visibleEventChips }) => {
              const dayKey = day.id.slice("month-".length);

              return (
                <div
                  className={cx(
                    "grid min-h-[104px] grid-rows-[auto_minmax(0,1fr)] border-r border-border bg-bg-tertiary p-2 text-left transition-colors duration-fast ease-hcb last:border-r-0 hover:bg-surface-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
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
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="sr-only">{day.weekday}</span>
                    <span className="text-[var(--text-sm)] font-semibold text-text-primary">{day.dateLabel}</span>
                  </div>
                  <div className="mt-2 grid min-h-0 content-start gap-1 overflow-hidden">
                    {visibleEventChips.map((calendarEvent) => (
                      <CalendarEventChip
                        className="min-h-5 px-1.5 py-0.5 text-[11px]"
                        event={calendarEvent}
                        key={calendarEvent.id}
                        labelVariant="title"
                        onKeyDown={(keyEvent) => {
                          keyEvent.stopPropagation();
                          handleActivationKeyDown(keyEvent, () => onOpen(calendarEvent));
                        }}
                        onOpen={onOpen}
                      />
                    ))}
                    {overflowCount > 0 ? <CalendarOverflowChip count={overflowCount} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
