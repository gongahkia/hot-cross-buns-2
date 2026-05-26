import type { CalendarEventViewModel } from "../../coreViewModels";

export function visibleCalendarEvent(
  event: CalendarEventViewModel,
  visibleCalendarIds: ReadonlySet<string>
): boolean {
  return visibleCalendarIds.has(event.calendarId);
}

export function splitAllDayEvents(events: CalendarEventViewModel[]): {
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
