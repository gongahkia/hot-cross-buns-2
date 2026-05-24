import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@shared/ipc/result";
import App from "./App";
import {
  goToSection,
  installHcb,
  now,
  runPaletteCommand,
  seededHcb,
  testSettings
} from "./test/appTestHelpers";

describe("App tasks", () => {
  it("renders task groups, subtasks, completion, empty state, and error state", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Tasks");

    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    const inboxTasks = screen.getByRole("list", { name: "Inbox tasks" });
    expect(within(inboxTasks).getByLabelText("Task due state Draft inbox triage rules")).toHaveTextContent("Due today");
    expect(within(inboxTasks).getByLabelText("Task priority Draft inbox triage rules")).toHaveTextContent("High priority");
    expect(screen.getByRole("heading", { name: "Planning" })).toBeInTheDocument();
    expect(screen.getByText("Map shortcut states")).toBeInTheDocument();
    expect(screen.getByText("Month grid shell")).toBeInTheDocument();

    const filters = screen.getByRole("toolbar", { name: "Task filters" });
    await user.click(screen.getByRole("button", { name: "Complete Draft inbox triage rules" }));
    expect(api.tasks.complete).toHaveBeenCalledWith({ id: "task-inbox-rules" });
    await user.click(within(filters).getByRole("button", { name: /Completed/ }));
    expect(await screen.findByRole("button", { name: "Reopen Draft inbox triage rules" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reopen Draft inbox triage rules" }));
    expect(api.tasks.reopen).toHaveBeenCalledWith({ id: "task-inbox-rules" });

    await user.click(within(filters).getByRole("button", { name: /Empty/ }));
    expect(screen.getByText("No tasks in this filter")).toBeInTheDocument();

    await user.click(within(filters).getByRole("button", { name: /Error/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("switches task perspectives and renders saved task view chips", async () => {
    const api = seededHcb();
    api.settings.get = vi.fn(async () =>
      ok(
        testSettings({
          savedTaskViews: [
            {
              id: "task-view-ops",
              name: "Ops focus",
              filters: {
                statuses: ["active"],
                tags: ["ops"]
              },
              groupBy: "tag",
              sortBy: "priority",
              createdAt: now,
              updatedAt: now
            }
          ]
        })
      )
    );
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Tasks");
    const perspectives = await screen.findByRole("tablist", { name: "Task perspectives" });

    expect(within(perspectives).getByRole("tab", { name: /Projects/ })).toHaveAttribute("aria-selected", "true");

    await user.click(within(perspectives).getByRole("tab", { name: "Tags" }));
    expect(await screen.findByRole("heading", { name: "ops" })).toBeInTheDocument();

    await user.click(within(perspectives).getByRole("tab", { name: /Saved/ }));
    const savedViews = screen.getByRole("list", { name: "Saved task perspectives" });

    expect(within(savedViews).getByText("Ops focus")).toBeInTheDocument();
    expect(within(savedViews).getByText("Tags: ops")).toBeInTheDocument();
    expect(within(savedViews).getByText("Group: tag")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ops" })).toBeInTheDocument();
  });

  it("creates, edits, deletes, and quick-captures tasks through preload", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Tasks");
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New task" }));
    await user.type(screen.getByRole("textbox", { name: "Task title" }), "Send status recap");
    fireEvent.change(screen.getByLabelText("Task due date"), { target: { value: "2026-05-23" } });
    await user.selectOptions(screen.getByLabelText("Task priority"), "medium");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Send status recap",
          listId: "list-inbox",
          dueDate: "2026-05-23",
          priority: "medium",
          parentId: null
        })
      );
    });

    await user.click(screen.getByRole("button", { name: /^Draft inbox triage rules / }));
    const titleInput = screen.getByRole("textbox", { name: "Task title" });
    await user.clear(titleInput);
    await user.type(titleInput, "Draft inbox triage rules v2");
    await user.selectOptions(screen.getByLabelText("Task list"), "list-planning");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.tasks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "task-inbox-rules",
          title: "Draft inbox triage rules v2",
          listId: "list-planning"
        })
      );
    });

    await user.click(screen.getByRole("button", { name: /^Review calendar fixture shape / }));
    await user.click(within(screen.getByTestId("inspector-actions")).getByRole("button", { name: "Delete" }));
    expect(api.tasks.delete).toHaveBeenCalledWith({ id: "task-calendar-fixtures" });

    await runPaletteCommand(user, "quick capture", /Quick capture/);
    await user.type(
      screen.getByRole("textbox", { name: "Quick capture task" }),
      "Review notes 2026-05-23 #Planning @2pm ~30m !locked +ops"
    );
    await user.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() => {
      expect(api.tasks.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: "Review notes",
          listId: "list-planning",
          dueDate: "2026-05-23",
          durationMinutes: 30,
          lockedSchedule: true,
          plannedStart: expect.any(String),
          plannedEnd: expect.any(String),
          tags: ["ops"]
        })
      );
    });
  });

  it("opens the task inspector from a row and blocks Escape while dirty", async () => {
    installHcb(seededHcb());
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Tasks");
    await user.click(await screen.findByRole("button", { name: /^Draft inbox triage rules / }));

    const inspector = await screen.findByTestId("inspector-shell");
    expect(inspector).toHaveAttribute("data-inspector-kind", "task");
    expect(inspector).toHaveAttribute("data-inspector-id", "task-inbox-rules");

    const titleInput = within(inspector).getByRole("textbox", { name: "Task title" });
    await user.clear(titleInput);
    await user.type(titleInput, "Draft inbox triage rules v2");
    await waitFor(() => expect(within(inspector).getByText("Unsaved")).toBeInTheDocument());

    await user.keyboard("{Escape}");
    expect(screen.getByTestId("inspector-shell")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Task title" })).toHaveValue("Draft inbox triage rules v2");
  });

  it("bulk selects, moves, completes, and deletes tasks through preload", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Tasks");
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();

    await user.click(screen.getByLabelText("Select Draft inbox triage rules"));
    await user.click(screen.getByLabelText("Select Review calendar fixture shape"));
    expect(screen.getByText("2 tasks selected")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Bulk move list"), "list-planning");
    await user.click(screen.getByRole("button", { name: "Move selected" }));

    await waitFor(() => {
      expect(api.tasks.move).toHaveBeenCalledWith({
        id: "task-inbox-rules",
        listId: "list-planning",
        parentId: null
      });
      expect(api.tasks.move).toHaveBeenCalledWith({
        id: "task-calendar-fixtures",
        listId: "list-planning",
        parentId: null
      });
    });

    await user.click(screen.getByLabelText("Select Draft inbox triage rules"));
    await user.click(screen.getByRole("button", { name: "Complete selected" }));

    await waitFor(() => {
      expect(api.tasks.complete).toHaveBeenCalledWith({ id: "task-inbox-rules" });
    });

    await user.click(screen.getByLabelText("Select Review calendar fixture shape"));
    await user.click(screen.getByRole("button", { name: "Delete selected" }));

    await waitFor(() => {
      expect(api.tasks.delete).toHaveBeenCalledWith({ id: "task-calendar-fixtures" });
    });
  });

  it("reverts optimistic task creation and retries recoverable task errors", async () => {
    const api = seededHcb();
    api.tasks.create = vi.fn()
      .mockResolvedValueOnce(
        err({
          code: "SERVICE_UNAVAILABLE",
          message: "Task queue is temporarily unavailable.",
          recoverable: true
        })
      )
      .mockResolvedValueOnce(
        ok({
          id: "task-retry-created",
          listId: "list-inbox",
          title: "Retry optimistic write",
          status: "active" as const,
          priority: "none" as const,
          dueAt: null,
          updatedAt: now,
          notes: "",
          parentId: null
        })
      );
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Tasks");
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New task" }));
    await user.type(screen.getByRole("textbox", { name: "Task title" }), "Retry optimistic write");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Task write not saved")).toBeInTheDocument();
    expect(screen.queryByText("Retry optimistic write")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(api.tasks.create).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getAllByText("Retry optimistic write").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Task write not saved")).not.toBeInTheDocument();
  });

  it("creates, renames, and deletes task lists through preload", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Tasks");
    expect(await screen.findByRole("heading", { name: "Inbox" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "New task list title" }), "Errands");
    await user.click(screen.getByRole("button", { name: "Create task list" }));
    expect(api.tasks.createTaskList).toHaveBeenCalledWith({ title: "Errands" });

    const inboxTitle = screen.getByRole("textbox", { name: "Rename Inbox" });
    await user.clear(inboxTitle);
    await user.type(inboxTitle, "Inbox renamed");
    await user.click(screen.getByRole("button", { name: "Save Inbox" }));
    expect(api.tasks.renameTaskList).toHaveBeenCalledWith({
      id: "list-inbox",
      title: "Inbox renamed"
    });

    await user.click(screen.getByRole("button", { name: "Delete Planning" }));
    expect(api.tasks.deleteTaskList).toHaveBeenCalledWith({ id: "list-planning" });
  });
});
