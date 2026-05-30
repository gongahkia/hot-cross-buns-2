export const googleCalendarEventColorIds = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11"
] as const;

export type GoogleCalendarEventColorId = (typeof googleCalendarEventColorIds)[number];

export interface GoogleCalendarEventColor {
  id: GoogleCalendarEventColorId;
  label: string;
  background: string;
  foreground: string;
}

export const googleCalendarEventColors: readonly GoogleCalendarEventColor[] = [
  { id: "1", label: "Lavender", background: "#a4bdfc", foreground: "#1d1d1d" },
  { id: "2", label: "Sage", background: "#7ae7bf", foreground: "#1d1d1d" },
  { id: "3", label: "Grape", background: "#dbadff", foreground: "#1d1d1d" },
  { id: "4", label: "Flamingo", background: "#ff887c", foreground: "#1d1d1d" },
  { id: "5", label: "Banana", background: "#fbd75b", foreground: "#1d1d1d" },
  { id: "6", label: "Tangerine", background: "#ffb878", foreground: "#1d1d1d" },
  { id: "7", label: "Peacock", background: "#46d6db", foreground: "#1d1d1d" },
  { id: "8", label: "Graphite", background: "#e1e1e1", foreground: "#1d1d1d" },
  { id: "9", label: "Blueberry", background: "#5484ed", foreground: "#ffffff" },
  { id: "10", label: "Basil", background: "#51b749", foreground: "#ffffff" },
  { id: "11", label: "Tomato", background: "#dc2127", foreground: "#ffffff" }
];

export const googleCalendarEventColorById = Object.fromEntries(
  googleCalendarEventColors.map((color) => [color.id, color])
) as Record<GoogleCalendarEventColorId, GoogleCalendarEventColor>;

export function googleCalendarEventColor(colorId: string | null | undefined): GoogleCalendarEventColor | null {
  if (!colorId || !isGoogleCalendarEventColorId(colorId)) {
    return null;
  }

  return googleCalendarEventColorById[colorId];
}

export function isGoogleCalendarEventColorId(colorId: string): colorId is GoogleCalendarEventColorId {
  return googleCalendarEventColorIds.includes(colorId as GoogleCalendarEventColorId);
}
