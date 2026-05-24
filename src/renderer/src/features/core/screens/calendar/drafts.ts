import type { CalendarEventCreateRequest, CalendarEventRecurrence } from "@shared/ipc/contracts";
import type { useCoreViewModelSource } from "../../coreViewModelSource";
import type { CalendarEventViewModel } from "../../coreViewModels";
import {
  addUtcDaysIso,
  dateInputValue,
  normalizeGuestEmails,
  normalizeReminderMinutes,
  startOfUtcDayIso
} from "../../coreScreenShared";
import type { CalendarCreateSeed, CalendarEventDraft } from "./types";

export function defaultCalendarId(source: ReturnType<typeof useCoreViewModelSource>): string {
  return (
    source.calendarSources.find((calendar) => calendar.selected)?.id ??
    source.calendarSources[0]?.id ??
    ""
  );
}

function defaultTimedStart(seed?: string): string {
  const base = seed ? new Date(seed) : new Date();

  if (!Number.isFinite(base.getTime())) {
    return new Date().toISOString();
  }

  if (seed) {
    base.setUTCSeconds(0, 0);
  } else {
    base.setUTCMinutes(0, 0, 0);
  }

  return base.toISOString();
}

export function newCalendarDraft(
  source: ReturnType<typeof useCoreViewModelSource>,
  seed?: CalendarCreateSeed
): CalendarEventDraft {
  const allDay = seed?.allDay ?? false;
  const startsAt = allDay ? startOfUtcDayIso(seed?.startsAt ?? new Date().toISOString()) : defaultTimedStart(seed?.startsAt);
  const endsAt = allDay ? addUtcDaysIso(startsAt, 1) : addUtcDaysIso(startsAt, 0);
  const seedEnd = seed?.endsAt && Date.parse(seed.endsAt) > Date.parse(startsAt) ? seed.endsAt : null;
  const timedEnd = allDay ? endsAt : seedEnd ?? new Date(Date.parse(startsAt) + 60 * 60 * 1000).toISOString();

  return {
    mode: "create",
    mutationState: undefined,
    title: "",
    calendarId: defaultCalendarId(source),
    startsAt,
    endsAt: allDay ? endsAt : timedEnd,
    allDay,
    location: "",
    notes: "",
    guests: "",
    reminderMinutes: "",
    repeatFrequency: "none",
    repeatInterval: "1",
    repeatEndsOn: "",
    repeatCount: ""
  };
}

export function editCalendarDraft(event: CalendarEventViewModel): CalendarEventDraft {
  const recurrence = calendarDraftRecurrenceFromRule(event.recurrenceRule);

  return {
    mode: "edit",
    id: event.id,
    mutationState: event.mutationState,
    title: event.title,
    calendarId: event.calendarId,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    location: event.location === "Scheduled" || event.location === "All day" ? "" : event.location,
    notes: event.notes === "Calendar cache" ? "" : event.notes,
    guests: event.guestEmails.join(", "),
    reminderMinutes: event.reminderMinutes[0] === undefined ? "" : String(event.reminderMinutes[0]),
    repeatFrequency: recurrence?.frequency ?? "none",
    repeatInterval: recurrence ? String(recurrence.interval) : "1",
    repeatEndsOn: recurrence?.endsOn ?? "",
    repeatCount: recurrence?.count === null || recurrence?.count === undefined ? "" : String(recurrence.count)
  };
}

export function calendarEventPayload(draft: CalendarEventDraft): CalendarEventCreateRequest {
  const reminderMinutes = draft.reminderMinutes === "" ? [] : normalizeReminderMinutes([Number(draft.reminderMinutes)]);

  return {
    title: draft.title.trim(),
    calendarId: draft.calendarId,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    allDay: draft.allDay,
    location: draft.location,
    notes: draft.notes,
    guestEmails: normalizeGuestEmails(draft.guests.split(",")),
    reminderMinutes,
    recurrence: calendarDraftRecurrence(draft)
  };
}

export function calendarEventDraftsEqual(
  left: CalendarEventDraft | null,
  right: CalendarEventDraft | null
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.mode === right.mode &&
    left.id === right.id &&
    left.mutationState === right.mutationState &&
    left.title === right.title &&
    left.calendarId === right.calendarId &&
    left.startsAt === right.startsAt &&
    left.endsAt === right.endsAt &&
    left.allDay === right.allDay &&
    left.location === right.location &&
    left.notes === right.notes &&
    left.guests === right.guests &&
    left.reminderMinutes === right.reminderMinutes &&
    left.repeatFrequency === right.repeatFrequency &&
    left.repeatInterval === right.repeatInterval &&
    left.repeatEndsOn === right.repeatEndsOn &&
    left.repeatCount === right.repeatCount
  );
}

function calendarDraftRecurrence(draft: CalendarEventDraft): CalendarEventRecurrence | null {
  if (draft.repeatFrequency === "none") {
    return null;
  }

  const interval = Math.min(366, Math.max(1, Number.parseInt(draft.repeatInterval, 10) || 1));
  const count = draft.repeatCount.trim() === ""
    ? null
    : Math.min(366, Math.max(1, Number.parseInt(draft.repeatCount, 10) || 1));

  return {
    frequency: draft.repeatFrequency,
    interval,
    endsOn: draft.repeatEndsOn.trim() || null,
    count
  };
}

function calendarDraftRecurrenceFromRule(rule: string | null | undefined): CalendarEventRecurrence | null {
  const line = rule
    ?.split("\n")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith("RRULE:"));

  if (!line) {
    return null;
  }

  const parts = Object.fromEntries(
    line
      .slice("RRULE:".length)
      .split(";")
      .map((part) => part.split("=", 2))
      .filter((part): part is [string, string] => part.length === 2)
  );
  const frequency = parts.FREQ?.toLowerCase();

  if (
    frequency !== "daily" &&
    frequency !== "weekly" &&
    frequency !== "monthly" &&
    frequency !== "yearly"
  ) {
    return null;
  }

  return {
    frequency,
    interval: Math.min(366, Math.max(1, Number.parseInt(parts.INTERVAL ?? "1", 10) || 1)),
    endsOn: parts.UNTIL ? recurrenceDateInputValue(parts.UNTIL) : null,
    count: parts.COUNT ? Math.min(366, Math.max(1, Number.parseInt(parts.COUNT, 10) || 1)) : null
  };
}

function recurrenceDateInputValue(value: string): string | null {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})/.exec(value);

  return dateOnly ? `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}` : null;
}

export function calendarRecurrenceSummary(draft: CalendarEventDraft): string {
  const recurrence = calendarDraftRecurrence(draft);

  if (!recurrence) {
    return "Does not repeat";
  }

  const unit =
    recurrence.frequency === "daily"
      ? "day"
      : recurrence.frequency === "weekly"
        ? "week"
        : recurrence.frequency === "monthly"
          ? "month"
          : "year";
  const cadence = recurrence.interval === 1
    ? `Every ${unit}`
    : `Every ${recurrence.interval} ${unit}s`;
  const qualifiers = [
    recurrence.endsOn ? `until ${recurrence.endsOn}` : null,
    recurrence.count ? `${recurrence.count} times` : null
  ].filter((part): part is string => part !== null);

  return qualifiers.length > 0 ? `${cadence}, ${qualifiers.join(", ")}` : cadence;
}

export function allDayEndInputValue(endsAt: string): string {
  const end = new Date(endsAt);
  end.setUTCDate(end.getUTCDate() - 1);
  return dateInputValue(end.toISOString());
}

export function calendarDraftRangeLabel(draft: CalendarEventDraft): string {
  if (draft.allDay) {
    return `${dateInputValue(draft.startsAt)} · All day`;
  }

  return `${dateInputValue(draft.startsAt)} · ${draft.startsAt.slice(11, 16)}-${draft.endsAt.slice(11, 16)}`;
}

export function calendarDraftDurationLabel(draft: CalendarEventDraft): string {
  if (draft.allDay) {
    const days = Math.max(
      1,
      Math.round((Date.parse(draft.endsAt) - Date.parse(draft.startsAt)) / (24 * 60 * 60 * 1000))
    );

    return `${days} day${days === 1 ? "" : "s"}`;
  }

  const minutes = Math.max(0, Math.round((Date.parse(draft.endsAt) - Date.parse(draft.startsAt)) / 60_000));
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}
