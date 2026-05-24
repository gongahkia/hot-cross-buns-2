import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ok } from "@shared/ipc/result";
import App from "./App";
import {
  installHcb,
  now,
  seededHcb,
  todayDate
} from "./test/appTestHelpers";

describe("App Today", () => {
  it("renders the schedule-backed Today timeline", async () => {
    installHcb(seededHcb());
    render(<App />);

    expect(await screen.findByText("Local cache ready")).toBeInTheDocument();
    const timeline = screen.getByRole("list", { name: "Today timeline" });

    expect(screen.getByText("Within capacity")).toBeInTheDocument();
    expect(within(timeline).getByText("Planner shell standup")).toBeInTheDocument();
    expect(within(timeline).getByText("Review calendar fixture shape")).toBeInTheDocument();
  });

  it("quick-adds a planned task from an empty Today slot", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText("Local cache ready")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Quick add at 11:00"));
    await user.type(screen.getByRole("textbox", { name: "Quick add title" }), "Write launch note");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(api.tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Write launch note",
          plannedStart: expect.stringContaining("T11:00:00.000Z"),
          plannedEnd: expect.stringContaining("T11:30:00.000Z"),
          durationMinutes: 30
        })
      );
    });
  });

  it("schedules an unscheduled task from the Today focus queue", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText("Local cache ready")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Schedule Draft inbox triage rules at 10:30"));

    await waitFor(() => {
      expect(api.calendar.scheduleTaskBlock).toHaveBeenCalledWith({
        taskId: "task-inbox-rules",
        calendarId: "cal-product",
        startsAt: expect.stringContaining("T10:30:00.000Z"),
        durationMinutes: 30
      });
    });
  });

  it("surfaces Today conflicts and creates a scheduled block from keyboard moves", async () => {
    const api = seededHcb();
    api.calendar.scheduleSuggest = vi.fn(async (request) =>
      ok({
        slots: [
          {
            startsAt: `${request.date}T10:00:00.000Z`,
            endsAt: `${request.date}T10:45:00.000Z`,
            taskId: "task-inbox-rules",
            locked: false,
            conflict: true
          },
          {
            startsAt: `${request.date}T10:15:00.000Z`,
            endsAt: `${request.date}T11:00:00.000Z`,
            taskId: "task-calendar-fixtures",
            locked: false,
            conflict: true
          }
        ],
        unscheduled: [],
        overloadMinutes: 0
      })
    );
    installHcb(api);
    render(<App />);

    expect(await screen.findByText("Local cache ready")).toBeInTheDocument();
    expect(screen.getAllByText("Conflict").length).toBeGreaterThan(0);
    fireEvent.keyDown(screen.getByRole("button", { name: /Draft inbox triage rules/ }), {
      key: "ArrowDown"
    });

    await waitFor(() => {
      expect(api.calendar.scheduleTaskBlock).toHaveBeenCalledWith({
        taskId: "task-inbox-rules",
        calendarId: "cal-product",
        startsAt: expect.stringContaining("T10:15:00.000Z"),
        durationMinutes: 45
      });
    });
  });

  it("moves and unschedules existing scheduled task blocks from Today", async () => {
    const api = seededHcb();
    api.calendar.listScheduledTaskBlocks = vi.fn(async () =>
      ok({
        items: [
          {
            id: "block-inbox",
            taskId: "task-inbox-rules",
            calendarEventId: "event-task-block",
            calendarId: "cal-product",
            title: "Draft inbox triage rules",
            startsAt: `${todayDate}T10:00:00.000Z`,
            endsAt: `${todayDate}T10:30:00.000Z`,
            durationMinutes: 30,
            status: "scheduled" as const,
            updatedAt: now
          }
        ],
        page: { limit: 250, totalKnown: 1 }
      })
    );
    api.calendar.scheduleSuggest = vi.fn(async (request) =>
      ok({
        slots: [
          {
            startsAt: `${request.date}T10:00:00.000Z`,
            endsAt: `${request.date}T10:30:00.000Z`,
            taskId: "task-inbox-rules",
            locked: false,
            conflict: false
          }
        ],
        unscheduled: [],
        overloadMinutes: 0
      })
    );
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    const blocks = await screen.findByRole("list", { name: "Scheduled task blocks" });
    expect(within(blocks).getByText("Scheduled")).toBeInTheDocument();

    await user.click(within(blocks).getByLabelText("Move Draft inbox triage rules later"));
    await waitFor(() => {
      expect(api.calendar.moveScheduledTaskBlock).toHaveBeenCalledWith({
        id: "block-inbox",
        calendarId: "cal-product",
        startsAt: expect.stringContaining("T10:30:00.000Z"),
        durationMinutes: 30
      });
    });

    await user.click(within(blocks).getByLabelText("Unschedule Draft inbox triage rules"));
    await waitFor(() => {
      expect(api.calendar.unscheduleTaskBlock).toHaveBeenCalledWith({
        id: "block-inbox",
        deleteCalendarEvent: true
      });
    });
  });

  it("repairs orphaned scheduled task blocks from Today", async () => {
    const api = seededHcb();
    api.calendar.listScheduledTaskBlocks = vi.fn(async () =>
      ok({
        items: [
          {
            id: "block-orphan",
            taskId: "task-inbox-rules",
            calendarEventId: "event-missing",
            calendarId: "cal-product",
            title: "Draft inbox triage rules",
            startsAt: `${todayDate}T10:00:00.000Z`,
            endsAt: `${todayDate}T10:30:00.000Z`,
            durationMinutes: 30,
            status: "orphaned" as const,
            updatedAt: now
          }
        ],
        page: { limit: 250, totalKnown: 1 }
      })
    );
    api.calendar.scheduleSuggest = vi.fn(async () =>
      ok({
        slots: [],
        unscheduled: [],
        overloadMinutes: 0
      })
    );
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    const blocks = await screen.findByRole("list", { name: "Scheduled task blocks" });
    expect(within(blocks).getByText("Needs repair")).toBeInTheDocument();

    await user.click(within(blocks).getByLabelText("Repair Draft inbox triage rules"));
    await waitFor(() => {
      expect(api.calendar.moveScheduledTaskBlock).toHaveBeenCalledWith({
        id: "block-orphan",
        calendarId: "cal-product",
        startsAt: expect.stringContaining("T10:00:00.000Z"),
        durationMinutes: 30
      });
    });
  });

  it("quick-adds an event from Today", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText("Local cache ready")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Quick add at 12:00"));
    await user.click(screen.getByRole("button", { name: "Event" }));
    await user.type(screen.getByRole("textbox", { name: "Quick add title" }), "Design review");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(api.calendar.create).toHaveBeenCalledWith({
        title: "Design review",
        calendarId: "cal-product",
        startsAt: expect.stringContaining("T12:00:00.000Z"),
        endsAt: expect.stringContaining("T12:30:00.000Z"),
        allDay: false,
        location: "",
        notes: "",
        guestEmails: [],
        reminderMinutes: []
      });
    });
  });
});
