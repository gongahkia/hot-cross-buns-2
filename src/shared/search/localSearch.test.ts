import { describe, expect, it } from "vitest";
import {
  matchesLocalSearchItem,
  parseLocalSearchQuery,
  resolveLocalSearchDomains
} from "./localSearch";

const now = "2026-05-22T12:00:00.000Z";

describe("local search query DSL", () => {
  it("parses text with task filters and quoted values", () => {
    const parsed = parseLocalSearchQuery(
      'triage source:task status:open due:today priority:high list:"Inbox Planning" notes:yes',
      { now }
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.text).toBe("triage");
    expect(parsed.filters).toMatchObject({
      domains: ["tasks"],
      taskStatus: "active",
      priority: "high",
      listTitle: "Inbox Planning",
      hasBody: true
    });
    expect(parsed.filters.due).toMatchObject({
      from: "2026-05-22T00:00:00.000Z",
      to: "2026-05-23T00:00:00.000Z",
      label: "today"
    });
    expect(parsed.chips.map((chip) => `${chip.label}: ${chip.value}`)).toEqual([
      "Source: tasks",
      "Status: active",
      "Due: today",
      "Priority: high",
      "List: Inbox Planning",
      "Body: yes"
    ]);
  });

  it("parses calendar date ranges and source aliases", () => {
    const parsed = parseLocalSearchQuery(
      'source:calendar,notes start:2026-05-22..2026-05-24 calendar:Product body:no planning',
      { now }
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.text).toBe("planning");
    expect(parsed.filters.domains).toEqual(["calendar", "notes"]);
    expect(parsed.filters.start).toMatchObject({
      from: "2026-05-22T00:00:00.000Z",
      to: "2026-05-25T00:00:00.000Z",
      label: "2026-05-22 to 2026-05-24"
    });
    expect(resolveLocalSearchDomains(parsed)).toEqual(["calendar"]);
  });

  it("reports invalid structured syntax without throwing", () => {
    const parsed = parseLocalSearchQuery(
      'source:servers status:blocked due:friday priority:urgent list: notes:maybe owner:gong',
      { now }
    );

    expect(parsed.errors.map((error) => error.code)).toEqual([
      "invalid_domain",
      "invalid_status",
      "invalid_date_window",
      "invalid_priority",
      "missing_filter_value",
      "invalid_presence",
      "unknown_filter"
    ]);
  });

  it("matches task filters without fuzzy ranking or remote state", () => {
    const parsed = parseLocalSearchQuery(
      "triage source:tasks status:active due:2026-05-22 priority:high list:Inbox notes:yes",
      { now }
    );

    expect(
      matchesLocalSearchItem(parsed, {
        domain: "tasks",
        title: "Draft inbox triage rules",
        body: "Local-only notes",
        taskStatus: "active",
        dueAt: "2026-05-22T09:00:00.000Z",
        priority: "high",
        listTitle: "Inbox"
      })
    ).toBe(true);
    expect(
      matchesLocalSearchItem(parsed, {
        domain: "tasks",
        title: "Draft inbox triage rules",
        body: "Local-only notes",
        taskStatus: "completed",
        dueAt: "2026-05-22T09:00:00.000Z",
        priority: "high",
        listTitle: "Inbox"
      })
    ).toBe(false);
  });

  it("matches calendar and note body presence filters", () => {
    const calendar = parseLocalSearchQuery(
      "startup source:calendar start:before:2026-05-23 calendar:Product body:yes",
      { now }
    );
    const notes = parseLocalSearchQuery("source:notes body:no", { now });

    expect(
      matchesLocalSearchItem(calendar, {
        domain: "calendar",
        title: "Planner shell standup",
        body: "Review cache-first startup.",
        startAt: "2026-05-22T09:30:00.000Z",
        calendarTitle: "Product"
      })
    ).toBe(true);
    expect(
      matchesLocalSearchItem(notes, {
        domain: "notes",
        title: "Empty scratchpad",
        body: ""
      })
    ).toBe(true);
  });
});
