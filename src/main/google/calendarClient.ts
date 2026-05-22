import type { GoogleApiTransport } from "./transport";

export interface GoogleCalendarListMirror {
  id: string;
  summary: string;
  description?: string | null;
  timeZone?: string | null;
  backgroundColor?: string | null;
  foregroundColor?: string | null;
  accessRole?: string | null;
  isSelected: boolean;
  isHidden: boolean;
  isPrimary: boolean;
  etag?: string | null;
  updatedAt?: string | null;
}

export type GoogleCalendarEventStatus = "confirmed" | "tentative" | "cancelled";

export interface GoogleCalendarEventMirror {
  id: string;
  calendarId: string;
  recurringEventId?: string | null;
  originalStartAt?: string | null;
  status: GoogleCalendarEventStatus;
  summary: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  startTimeZone?: string | null;
  endAt: string;
  endTimeZone?: string | null;
  isAllDay: boolean;
  recurrenceRule?: string | null;
  transparency?: string | null;
  visibility?: string | null;
  attendeeEmails?: string[];
  reminderMinutes?: number[];
  etag?: string | null;
  sequence?: number | null;
  updatedAt?: string | null;
}

export interface GoogleCalendarEventsPage {
  events: readonly GoogleCalendarEventMirror[];
  nextSyncToken?: string | null;
}

export interface GoogleCalendarReadTransport {
  listCalendarLists(): Promise<readonly GoogleCalendarListMirror[]>;
  listEvents(request: {
    calendarId: string;
    syncToken?: string | null;
    timeMin?: string | null;
    defaultTimeZone?: string | null;
  }): Promise<GoogleCalendarEventsPage>;
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarListItemDto[];
}

interface GoogleCalendarListItemDto {
  id: string;
  summary?: string;
  description?: string;
  timeZone?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  selected?: boolean;
  hidden?: boolean;
  primary?: boolean;
  accessRole?: string;
  etag?: string;
  updated?: string;
}

interface GoogleEventsResponse {
  items?: GoogleEventDto[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

interface GoogleEventDto {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: GoogleEventDateDto;
  end?: GoogleEventDateDto;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GoogleEventDateDto;
  etag?: string;
  updated?: string;
  sequence?: number;
  transparency?: string;
  visibility?: string;
  attendees?: GoogleEventAttendeeDto[];
  reminders?: GoogleEventRemindersDto;
}

interface GoogleEventDateDto {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

interface GoogleEventAttendeeDto {
  email?: string;
}

interface GoogleEventRemindersDto {
  overrides?: Array<{ method?: string; minutes?: number }>;
}

const CALENDAR_LIST_FIELDS =
  "items(id,summary,description,timeZone,backgroundColor,foregroundColor,selected,hidden,primary,accessRole,etag,updated)";
const EVENTS_FIELDS =
  "nextPageToken,nextSyncToken,items(id,summary,description,location,status,start,end,recurrence,recurringEventId,originalStartTime,etag,updated,sequence,transparency,visibility,attendees(email),reminders(overrides(method,minutes)))";

export class GoogleCalendarHttpAdapter implements GoogleCalendarReadTransport {
  private readonly transport: GoogleApiTransport;

  constructor(transport: GoogleApiTransport) {
    this.transport = transport;
  }

  async listCalendarLists(): Promise<readonly GoogleCalendarListMirror[]> {
    const response = await this.transport.getJson<GoogleCalendarListResponse>({
      path: "/calendar/v3/users/me/calendarList",
      query: {
        fields: CALENDAR_LIST_FIELDS
      }
    });

    return (response.items ?? []).map((item) => ({
      id: item.id,
      summary: item.summary ?? "Untitled calendar",
      description: item.description ?? null,
      timeZone: item.timeZone ?? null,
      backgroundColor: item.backgroundColor ?? null,
      foregroundColor: item.foregroundColor ?? null,
      accessRole: item.accessRole ?? null,
      isSelected: item.selected ?? true,
      isHidden: item.hidden ?? false,
      isPrimary: item.primary ?? item.id === "primary",
      etag: item.etag ?? null,
      updatedAt: normalizeIsoDateTime(item.updated)
    }));
  }

  async listEvents(request: {
    calendarId: string;
    syncToken?: string | null;
    timeMin?: string | null;
    defaultTimeZone?: string | null;
  }): Promise<GoogleCalendarEventsPage> {
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;
    const events: GoogleCalendarEventMirror[] = [];

    do {
      const response = await this.transport.getJson<GoogleEventsResponse>({
        path: `/calendar/v3/calendars/${encodeGooglePathComponent(request.calendarId)}/events`,
        query: {
          singleEvents: "true",
          showDeleted: "true",
          maxResults: "2500",
          fields: EVENTS_FIELDS,
          syncToken: request.syncToken ?? undefined,
          timeMin:
            request.syncToken === undefined || request.syncToken === null
              ? request.timeMin ?? undefined
              : undefined,
          pageToken
        }
      });

      events.push(
        ...(response.items ?? []).map((item) =>
          mapEvent(item, request.calendarId, request.defaultTimeZone ?? null)
        )
      );
      nextSyncToken = response.nextSyncToken ?? nextSyncToken;
      pageToken = response.nextPageToken;
    } while (pageToken !== undefined && pageToken.length > 0);

    return {
      events,
      nextSyncToken
    };
  }
}

function mapEvent(
  item: GoogleEventDto,
  calendarId: string,
  defaultTimeZone: string | null
): GoogleCalendarEventMirror {
  const fallback = normalizeIsoDateTime(item.updated) ?? new Date(0).toISOString();
  const isAllDay = item.start?.date !== undefined;
  const startAt = eventDateToIso(item.start, fallback);
  const endAt = eventDateToIso(item.end, startAt);
  const startTimeZone = item.start?.timeZone ?? defaultTimeZone;
  const endTimeZone = item.end?.timeZone ?? startTimeZone;

  return {
    id: item.id,
    calendarId,
    recurringEventId: item.recurringEventId ?? null,
    originalStartAt: item.originalStartTime === undefined ? null : eventDateToIso(item.originalStartTime, startAt),
    status: normalizeEventStatus(item.status),
    summary: item.summary ?? "Untitled event",
    description: normalizeDescription(item.description),
    location: item.location ?? null,
    startAt,
    startTimeZone,
    endAt,
    endTimeZone,
    isAllDay,
    recurrenceRule: item.recurrence?.join("\n") ?? null,
    transparency: item.transparency ?? null,
    visibility: item.visibility ?? null,
    attendeeEmails: normalizeAttendeeEmails(item.attendees),
    reminderMinutes: normalizeReminderMinutes(item.reminders),
    etag: item.etag ?? null,
    sequence: item.sequence ?? null,
    updatedAt: normalizeIsoDateTime(item.updated)
  };
}

function normalizeAttendeeEmails(attendees: GoogleEventAttendeeDto[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const attendee of attendees ?? []) {
    const email = attendee.email?.trim().toLowerCase();

    if (email === undefined || email.length === 0 || seen.has(email)) {
      continue;
    }

    seen.add(email);
    result.push(email);
  }

  return result;
}

function normalizeReminderMinutes(reminders: GoogleEventRemindersDto | undefined): number[] {
  const seen = new Set<number>();
  const result: number[] = [];

  for (const reminder of reminders?.overrides ?? []) {
    if (reminder.method !== "popup" && reminder.method !== "email") {
      continue;
    }

    const minutes = reminder.minutes;

    if (
      minutes === undefined ||
      !Number.isInteger(minutes) ||
      minutes < 0 ||
      minutes > 28 * 24 * 60 ||
      seen.has(minutes)
    ) {
      continue;
    }

    seen.add(minutes);
    result.push(minutes);
  }

  return result.sort((left, right) => left - right);
}

function eventDateToIso(value: GoogleEventDateDto | undefined, fallback: string): string {
  if (value?.dateTime !== undefined) {
    return normalizeIsoDateTime(value.dateTime) ?? fallback;
  }

  if (value?.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    return `${value.date}T00:00:00.000Z`;
  }

  return fallback;
}

function normalizeEventStatus(status: string | undefined): GoogleCalendarEventStatus {
  if (status === "tentative" || status === "cancelled") {
    return status;
  }

  return "confirmed";
}

function normalizeIsoDateTime(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeDescription(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) {
    return null;
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .trim();
}

function encodeGooglePathComponent(value: string): string {
  return encodeURIComponent(value).replace(/%40/g, "@");
}
