import type { PointerEvent } from "react";
import { startOfUtcDayIso } from "../../coreScreenShared";
import type {
  CalendarDayViewModel,
  CalendarEventViewModel,
  CalendarMonthWeekViewModel,
  CalendarViewId
} from "../../coreViewModels";
import type {
  CalendarDaySlot,
  CalendarEventDayIndex,
  CalendarTimeBlock,
  VisibleCalendarDay,
  VisibleCalendarMonthWeek,
  VisibleCalendarTimelineDay
} from "./types";

export const dayPlanningHours = Array.from({ length: 12 }, (_, index) => index + 7);
export const calendarTimelineHours = Array.from({ length: 24 }, (_, index) => index);
export const calendarDaySlotRowHeight = 64;
export const calendarDayViewportHeight = 520;
export const calendarWeekColumnWidth = 160;
export const calendarMonthVisibleChipCount = 3;
export const calendarWeekVisibleTimedCount = 4;
export const calendarWeekVisibleAllDayCount = 2;
export const calendarTimelineVisibleAllDayCount = 4;
export const calendarTimelineVisibleHourlyCount = 4;

export function hourSlotIso(day: string, hour: number): string {
  return `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

export function addUtcMinutesIso(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60 * 1000).toISOString();
}

export function hourSlotLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function calendarDisplayHourLabel(hour: number): string {
  if (hour === 0) {
    return "12 AM";
  }

  if (hour === 12) {
    return "12 PM";
  }

  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function calendarDayKey(day: CalendarDayViewModel): string {
  const separatorIndex = day.id.indexOf("-");
  return separatorIndex >= 0 ? day.id.slice(separatorIndex + 1) : day.id;
}

export function calendarViewLabel(viewId: CalendarViewId): string {
  if (viewId === "multiDay") {
    return "Multi-Day";
  }

  return `${viewId[0].toUpperCase()}${viewId.slice(1)}`;
}

export function isCalendarTimelineView(viewId: CalendarViewId): boolean {
  return viewId === "day" || viewId === "multiDay" || viewId === "week";
}

function calendarDateFromDay(day: CalendarDayViewModel): Date {
  return new Date(`${calendarDayKey(day)}T00:00:00.000Z`);
}

export function calendarDateTitle(day: CalendarDayViewModel, includeYear = true): string {
  return calendarDateTitleFromIso(calendarDayKey(day), includeYear);
}

export function calendarDateTitleFromIso(day: string, includeYear = true): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC"
  }).format(new Date(`${day}T00:00:00.000Z`));
}

export function calendarRangeTitle(days: CalendarDayViewModel[]): string {
  const firstDay = days[0];
  const lastDay = days.at(-1);

  if (!firstDay || !lastDay) {
    return "Calendar";
  }

  const start = calendarDateFromDay(firstDay);
  const end = calendarDateFromDay(lastDay);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth) {
    const month = new Intl.DateTimeFormat(undefined, {
      month: "long",
      timeZone: "UTC"
    }).format(start);
    return `${month} ${start.getUTCDate()}-${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  });
  return `${formatter.format(start)} - ${formatter.format(end)}, ${end.getUTCFullYear()}`;
}

function calendarIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function calendarDateFromIsoDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function calendarTodayKey(): string {
  return calendarIsoDate(new Date(startOfUtcDayIso(new Date())));
}

function calendarStartOfUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function calendarAddUtcDays(day: string, days: number): string {
  const date = calendarDateFromIsoDate(day);
  date.setUTCDate(date.getUTCDate() + days);
  return calendarIsoDate(date);
}

export function calendarAddUtcMonths(day: string, months: number): string {
  const source = calendarDateFromIsoDate(day);
  const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();

  target.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return calendarIsoDate(target);
}

export function calendarMonthOffset(fromDay: string, toDay: string): number {
  const from = calendarDateFromIsoDate(fromDay);
  const to = calendarDateFromIsoDate(toDay);

  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
}

export function calendarMonthTitle(day: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(calendarDateFromIsoDate(day));
}

function calendarWeekdayLabel(date: Date, style: "long" | "short" = "short"): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: style,
    timeZone: "UTC"
  }).format(date);
}

function calendarEventRangeDayKeys(startsAt: string, endsAt: string): string[] {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  const keys: string[] = [];
  const cursor = calendarStartOfUtcDate(new Date(startMs));
  const lastDay = calendarStartOfUtcDate(new Date(endMs - 1));

  while (cursor.getTime() <= lastDay.getTime()) {
    keys.push(calendarIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

export function buildCalendarEventDayIndex(events: CalendarEventViewModel[]): CalendarEventDayIndex {
  const eventsByDay = new Map<string, CalendarEventViewModel[]>();

  for (const event of events) {
    for (const day of calendarEventRangeDayKeys(event.startsAt, event.endsAt)) {
      const dayEvents = eventsByDay.get(day) ?? [];
      dayEvents.push(event);
      eventsByDay.set(day, dayEvents);
    }
  }

  for (const dayEvents of eventsByDay.values()) {
    dayEvents.sort(
      (left, right) =>
        left.startsAt.localeCompare(right.startsAt) ||
        left.endsAt.localeCompare(right.endsAt) ||
        left.id.localeCompare(right.id)
    );
  }

  return { eventsByDay };
}

export function calendarEventsForDay(index: CalendarEventDayIndex, day: string): CalendarEventViewModel[] {
  return index.eventsByDay.get(day) ?? [];
}

export function calendarDayViewForDate(
  index: CalendarEventDayIndex,
  day: string,
  variant: "day" | "range" | "month" = "range",
  currentMonth?: number
): CalendarDayViewModel {
  const date = calendarDateFromIsoDate(day);

  return {
    id: `${variant}-${day}`,
    weekday: calendarWeekdayLabel(date, variant === "day" ? "long" : "short"),
    dateLabel: String(date.getUTCDate()),
    isToday: day === calendarTodayKey(),
    isOutsideMonth: currentMonth === undefined ? false : date.getUTCMonth() !== currentMonth,
    events: calendarEventsForDay(index, day)
  };
}

export function calendarWeekDaysForDate(index: CalendarEventDayIndex, day: string): CalendarDayViewModel[] {
  const anchor = calendarDateFromIsoDate(day);
  const sunday = new Date(anchor);
  sunday.setUTCDate(anchor.getUTCDate() - anchor.getUTCDay());

  return Array.from({ length: 7 }, (_, dayOffset) => {
    const date = new Date(sunday);
    date.setUTCDate(sunday.getUTCDate() + dayOffset);
    return calendarDayViewForDate(index, calendarIsoDate(date), "range");
  });
}

export function calendarRangeDaysForDate(
  index: CalendarEventDayIndex,
  day: string,
  dayCount: number
): CalendarDayViewModel[] {
  const count = Math.max(1, dayCount);

  return Array.from({ length: count }, (_, dayOffset) =>
    calendarDayViewForDate(index, calendarAddUtcDays(day, dayOffset), count === 1 ? "day" : "range")
  );
}

export function calendarMonthWeeksForDate(
  index: CalendarEventDayIndex,
  day: string
): CalendarMonthWeekViewModel[] {
  const anchor = calendarDateFromIsoDate(day);
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - first.getUTCDay());

  return Array.from({ length: 6 }, (_, weekIndex) => ({
    id: `month-${day}-week-${weekIndex}`,
    days: Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(gridStart);
      date.setUTCDate(gridStart.getUTCDate() + weekIndex * 7 + dayIndex);
      return calendarDayViewForDate(index, calendarIsoDate(date), "month", first.getUTCMonth());
    })
  }));
}

export function calendarPointerTimeIso(
  dayKey: string,
  hour: number,
  event: PointerEvent<HTMLElement>
): string {
  const rect = event.currentTarget.getBoundingClientRect();
  const offset = Math.min(Math.max(event.clientY - rect.top, 0), Math.max(1, rect.height) - 1);
  const quarter = Math.min(3, Math.max(0, Math.floor((offset / Math.max(1, rect.height)) * 4)));
  const minutes = quarter * 15;

  return `${dayKey}T${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00.000Z`;
}

export function calendarTimeBlock(startsAt: string, pointerAt: string): CalendarTimeBlock {
  const startMs = Date.parse(startsAt);
  const pointerMs = Date.parse(pointerAt);
  const pointerEnd = addUtcMinutesIso(pointerAt, 15);
  const starts = pointerMs < startMs ? pointerAt : startsAt;
  const ends = pointerMs < startMs ? addUtcMinutesIso(startsAt, 15) : pointerEnd;

  return {
    id: `${starts}-${ends}`,
    dayKey: starts.slice(0, 10),
    startsAt: starts,
    endsAt: ends
  };
}

export function calendarBlocksOverlapHour(blocks: CalendarTimeBlock[], dayKey: string, hour: number): boolean {
  const startsAt = Date.parse(hourSlotIso(dayKey, hour));
  const endsAt = Date.parse(hourSlotIso(dayKey, hour + 1));

  return blocks.some(
    (block) =>
      block.dayKey === dayKey &&
      Date.parse(block.startsAt) < endsAt &&
      Date.parse(block.endsAt) > startsAt
  );
}

export function sortedCalendarTimeBlocks(blocks: CalendarTimeBlock[]): CalendarTimeBlock[] {
  return [...blocks].sort(
    (left, right) =>
      left.startsAt.localeCompare(right.startsAt) ||
      left.endsAt.localeCompare(right.endsAt) ||
      left.id.localeCompare(right.id)
  );
}

export function calendarTimeBlockLabel(block: CalendarTimeBlock): string {
  const day = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short"
  }).format(new Date(block.startsAt));
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  });

  return `${day} ${timeFormatter.format(new Date(block.startsAt))}-${timeFormatter.format(new Date(block.endsAt))}`;
}

export function calendarAvailabilitySnippet({
  durationMinutes,
  slots,
  timeZone,
  title
}: {
  durationMinutes: number;
  slots: CalendarTimeBlock[];
  timeZone: string;
  title: string;
}): string {
  const lines = sortedCalendarTimeBlocks(slots).map((slot) => `- ${calendarTimeBlockLabel(slot)}`);

  return [
    title.trim() || "Meeting",
    `${durationMinutes} minutes - ${timeZone}`,
    ...lines
  ].join("\n");
}

function eventOverlapsHour(event: CalendarEventViewModel, day: string, hour: number): boolean {
  const startsAt = Date.parse(hourSlotIso(day, hour));
  const endsAt = Date.parse(hourSlotIso(day, hour + 1));

  return Date.parse(event.startsAt) < endsAt && Date.parse(event.endsAt) > startsAt;
}

function visibleCalendarDay(
  day: CalendarDayViewModel,
  visibleCalendarIds: ReadonlySet<string>
): VisibleCalendarDay {
  const visibleEvents = day.events.filter((event) => visibleCalendarEvent(event, visibleCalendarIds));
  const { allDayEvents, timedEvents } = splitAllDayEvents(visibleEvents);

  return {
    allDayEvents,
    day,
    timedEvents,
    visibleEvents
  };
}

export function visibleCalendarTimelineDays(
  days: CalendarDayViewModel[],
  visibleCalendarIds: ReadonlySet<string>
): VisibleCalendarTimelineDay[] {
  return days.map((day) => {
    const visibleDay = visibleCalendarDay(day, visibleCalendarIds);
    const dayKey = calendarDayKey(day);
    const timedEventsByHour = new Map<number, CalendarEventViewModel[]>();

    for (const event of visibleDay.timedEvents) {
      for (const hour of calendarTimelineHours) {
        if (!eventOverlapsHour(event, dayKey, hour)) {
          continue;
        }

        const hourEvents = timedEventsByHour.get(hour) ?? [];
        hourEvents.push(event);
        timedEventsByHour.set(hour, hourEvents);
      }
    }

    return {
      ...visibleDay,
      timedEventsByHour
    };
  });
}

export function calendarDaySlots(day: string, timedEvents: CalendarEventViewModel[]): CalendarDaySlot[] {
  const eventsByHour = new Map<number, CalendarEventViewModel[]>();

  for (const event of timedEvents) {
    for (const hour of dayPlanningHours) {
      if (!eventOverlapsHour(event, day, hour)) {
        continue;
      }

      const hourEvents = eventsByHour.get(hour) ?? [];
      hourEvents.push(event);
      eventsByHour.set(hour, hourEvents);
    }
  }

  return dayPlanningHours.map((hour) => ({
    hour,
    label: hourSlotLabel(hour),
    startsAt: hourSlotIso(day, hour),
    events: eventsByHour.get(hour) ?? []
  }));
}

export function visibleCalendarMonthWeeks(
  weeks: CalendarMonthWeekViewModel[],
  visibleCalendarIds: ReadonlySet<string>
): VisibleCalendarMonthWeek[] {
  return weeks.map((week) => ({
    id: week.id,
    days: week.days.map((day) => {
      const visibleEvents = day.events.filter((event) => visibleCalendarEvent(event, visibleCalendarIds));
      const visibleEventChips = visibleEvents.slice(0, calendarMonthVisibleChipCount);

      return {
        day,
        overflowCount: Math.max(0, visibleEvents.length - visibleEventChips.length),
        visibleEventChips
      };
    })
  }));
}

function splitAllDayEvents(events: CalendarEventViewModel[]): {
  allDayEvents: CalendarEventViewModel[];
  timedEvents: CalendarEventViewModel[];
} {
  const allDayEvents: CalendarEventViewModel[] = [];
  const timedEvents: CalendarEventViewModel[] = [];

  for (const event of events) {
    if (event.allDay) {
      allDayEvents.push(event);
    } else {
      timedEvents.push(event);
    }
  }

  return { allDayEvents, timedEvents };
}

export function sameTimeOnDate(value: string, day: string): string {
  return `${day}T${value.slice(11)}`;
}

export function visibleCalendarEvent(
  event: CalendarEventViewModel,
  visibleCalendarIds: ReadonlySet<string>
): boolean {
  return visibleCalendarIds.has(event.calendarId);
}

export function calendarEventTimeOfDayIso(sourceIso: string, dayKey: string): string {
  const parsed = new Date(sourceIso);

  if (!Number.isFinite(parsed.getTime())) {
    return `${dayKey}T00:00:00.000Z`;
  }

  return `${dayKey}T${String(parsed.getUTCHours()).padStart(2, "0")}:${String(parsed.getUTCMinutes()).padStart(2, "0")}:00.000Z`;
}
