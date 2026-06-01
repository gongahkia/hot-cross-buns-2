import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ok } from "@shared/ipc/result";
import App from "./App";
import {
  goToSection,
  installHcb,
  now,
  seededHcb
} from "./test/appTestHelpers";

describe("App notes", () => {
  it("creates, edits, and deletes notes through preload", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Notes");
    expect(screen.queryByRole("button", { name: "All notes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Starred" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Notes" })).toBeInTheDocument();
    expect(await screen.findByText("Startup data flow")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /New note/ }));
    const titleInput = await screen.findByRole("textbox", { name: "Note title" });
    const bodyInput = screen.getByRole("textbox", { name: "Note body" });
    expect(screen.getByRole("combobox", { name: "Note template" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Preview" })).not.toBeInTheDocument();

    await user.clear(titleInput);
    await user.type(titleInput, "Release note draft");
    await user.type(bodyInput, "Document planner flow.");

    await waitFor(() => {
      expect(api.notes.create).toHaveBeenCalled();
      expect(api.notes.update).toHaveBeenCalledWith({
        id: "note-created",
        title: "Release note draft",
        body: "Document planner flow."
      });
    });

    await user.click(screen.getByRole("button", { name: "Delete selected note" }));
    expect(api.notes.delete).toHaveBeenCalledWith({ id: "note-created" });

    await user.click(screen.getByRole("button", { name: "Delete selected note" }));
    expect(api.notes.delete).toHaveBeenCalledWith({ id: "note-cache-first" });
    expect(screen.getByText("No notes in this list")).toBeInTheDocument();
  });

  it("opens selected notes in the inspector and flushes pending edits on close", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Notes");
    await user.click(await screen.findByText("Startup data flow"));

    const inspector = await screen.findByTestId("inspector-shell");
    expect(inspector).toHaveAttribute("data-inspector-kind", "note");
    const inspectorBody = within(inspector).getByTestId("inspector-body");
    expect(within(inspectorBody).getByRole("heading", { name: "Startup data flow" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Note body" })).not.toBeInTheDocument();

    await user.click(
      within(screen.getByTestId("inspector-actions")).getByRole("button", { name: "Edit" })
    );
    const bodyInput = await screen.findByRole("textbox", { name: "Note body" });
    await user.type(bodyInput, " Pending close flush.");
    await user.click(screen.getByTestId("inspector-close"));

    await waitFor(() => {
      expect(api.notes.update).toHaveBeenCalledWith({
        id: "note-cache-first",
        title: "Startup data flow",
        body: expect.stringContaining("Pending close flush.")
      });
    });
    expect(screen.queryByTestId("inspector-shell")).not.toBeInTheDocument();
  });

  it("flushes pending note edits before switching the selected note row", async () => {
    const api = seededHcb();
    api.notes.list = vi.fn(async () =>
      ok({
        items: [
          {
            id: "note-cache-first",
            listId: "note-list:default",
            listTitle: "Notes",
            title: "Startup data flow",
            preview: "Renderer paints from SQLite.",
            updatedAt: now
          },
          {
            id: "note-daily",
            listId: "note-list:default",
            listTitle: "Notes",
            title: "Daily note",
            preview: "Backlink review.",
            updatedAt: now
          }
        ],
        lists: [{ id: "note-list:default", title: "Notes", noteCount: 2, updatedAt: now }],
        page: { limit: 50, totalKnown: 2 }
      })
    );
    api.notes.get = vi.fn(async ({ id }) =>
      ok(
        id === "note-daily"
          ? {
              id,
              listId: "note-list:default",
              listTitle: "Notes",
              title: "Daily note",
              preview: "Backlink review.",
              body: "Review backlinks.",
              updatedAt: now
            }
          : {
              id,
              listId: "note-list:default",
              listTitle: "Notes",
              title: "Startup data flow",
              preview: "Renderer paints from SQLite.",
              body: "Renderer paints from SQLite before fresh sync completes.",
              updatedAt: now
            }
      )
    );
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Notes");
    await user.click(await screen.findByText("Startup data flow"));
    await user.click(
      within(screen.getByTestId("inspector-actions")).getByRole("button", { name: "Edit" })
    );
    await user.type(await screen.findByRole("textbox", { name: "Note body" }), " Switch flush.");
    const notesList = screen.getByRole("list", { name: "Notes" });
    await user.click(within(notesList).getByRole("button", { name: "Open note Daily note" }));

    await waitFor(() => {
      expect(api.notes.update).toHaveBeenCalledWith({
        id: "note-cache-first",
        title: "Startup data flow",
        body: expect.stringContaining("Switch flush.")
      });
    });
    const inspector = await screen.findByTestId("inspector-shell");
    const inspectorBody = within(inspector).getByTestId("inspector-body");
    expect(within(inspectorBody).getByRole("heading", { name: "Daily note" })).toBeInTheDocument();
  });

  it("renders note markdown preview, outgoing links, and backlinks", async () => {
    const api = seededHcb();
    api.notes.list = vi.fn(async () =>
      ok({
        items: [
          {
            id: "note-project",
            listId: "note-list:default",
            listTitle: "Notes",
            title: "Project plan",
            preview: "See [[Daily note]]",
            updatedAt: now
          },
          {
            id: "note-daily",
            listId: "note-list:default",
            listTitle: "Notes",
            title: "Daily note",
            preview: "Back to [[Project plan]]",
            updatedAt: now
          }
        ],
        lists: [{ id: "note-list:default", title: "Notes", noteCount: 2, updatedAt: now }],
        page: { limit: 50, totalKnown: 2 }
      })
    );
    api.notes.get = vi.fn(async ({ id }) =>
      ok(
        id === "note-daily"
          ? {
              id,
              listId: "note-list:default",
              listTitle: "Notes",
              title: "Daily note",
              preview: "Back to [[Project plan]]",
              body: "Back to [[Project plan]]",
              updatedAt: now
            }
          : {
              id,
              listId: "note-list:default",
              listTitle: "Notes",
              title: "Project plan",
              preview: "See [[Daily note]]",
              body: "# Plan\n- [x] Kickoff\nSee [[Daily note]]",
              updatedAt: now
            }
      )
    );
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Notes");
    await user.click(await screen.findByText("Project plan"));

    const preview = await screen.findByRole("region", { name: "Note preview" });
    expect(within(preview).getByText("Plan")).toBeInTheDocument();
    expect(within(preview).getByRole("checkbox")).toBeChecked();
    expect(preview).toHaveTextContent("Kickoff");
    expect(preview).toHaveTextContent("See [[Daily note]]");
    const dailyLink = screen.getByRole("button", { name: "Open linked note Daily note" });

    dailyLink.focus();
    await user.keyboard("{Enter}");
    const inspector = await screen.findByTestId("inspector-shell");
    const inspectorBody = within(inspector).getByTestId("inspector-body");
    expect(within(inspectorBody).getByRole("heading", { name: "Daily note" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open backlink Project plan" })).toBeInTheDocument();
  });

  it("inserts planner links and creates notes from the template field", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Notes");
    await user.click(await screen.findByText("Startup data flow"));
    await user.click(
      within(screen.getByTestId("inspector-actions")).getByRole("button", { name: "Edit" })
    );
    const bodyInput = await screen.findByRole("textbox", { name: "Note body" });

    await user.type(screen.getByRole("combobox", { name: "Planner link target" }), "triage");
    await user.click(await screen.findByRole("option", { name: /Draft inbox triage rules/ }));
    expect((bodyInput as HTMLTextAreaElement).value).toContain("[[task:Draft inbox triage rules]]");

    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getAllByText("task: Draft inbox triage rules").length).toBeGreaterThan(0);

    expect(screen.queryByRole("button", { name: "Daily note" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Meeting note" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /New note/ }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "Note template" }), "daily");
    await waitFor(() => {
      expect(api.notes.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "note-created",
          title: expect.stringMatching(/^Daily \d{4}-\d{2}-\d{2}$/),
          body: expect.stringContaining("tags: daily")
        })
      );
    });
    expect((screen.getByRole("textbox", { name: "Note body" }) as HTMLTextAreaElement).value).toContain("tags: daily");
  });

  it("renames note lists from the column menu", async () => {
    const api = seededHcb();
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Renamed notes");
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Notes");
    await user.click(await screen.findByRole("button", { name: "More actions for Notes" }));
    await user.click(await screen.findByRole("button", { name: "Rename list" }));

    expect(promptSpy).toHaveBeenCalledWith("Rename list", "Notes");
    expect(api.notes.renameList).toHaveBeenCalledWith({
      id: "note-list:default",
      title: "Renamed notes"
    });
  });

  it("deletes custom note lists and moves their notes to Notes", async () => {
    const api = seededHcb();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    api.notes.list = vi.fn(async () =>
      ok({
        items: [
          {
            id: "note-default",
            listId: "note-list:default",
            listTitle: "Notes",
            title: "Default note",
            preview: "Default",
            updatedAt: now
          },
          {
            id: "note-side",
            listId: "note-list:side",
            listTitle: "Side notes",
            title: "Side note",
            preview: "Side",
            updatedAt: now
          }
        ],
        lists: [
          { id: "note-list:default", title: "Notes", noteCount: 1, updatedAt: now },
          { id: "note-list:side", title: "Side notes", noteCount: 1, updatedAt: now }
        ],
        page: { limit: 50, totalKnown: 2 }
      })
    );
    api.notes.get = vi.fn(async ({ id }) =>
      ok(
        id === "note-side"
          ? {
              id,
              listId: "note-list:side",
              listTitle: "Side notes",
              title: "Side note",
              preview: "Side",
              body: "Side",
              updatedAt: now
            }
          : {
              id,
              listId: "note-list:default",
              listTitle: "Notes",
              title: "Default note",
              preview: "Default",
              body: "Default",
              updatedAt: now
            }
      )
    );
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Notes");
    await user.click(await screen.findByRole("button", { name: "More actions for Side notes" }));
    await user.click(await screen.findByRole("button", { name: "Delete list" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete Side notes? Notes in this list move to Notes.");
    expect(api.notes.deleteList).toHaveBeenCalledWith({ id: "note-list:side" });
    expect(screen.queryByRole("heading", { name: "Side notes" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Notes" })).getByText("Side note")).toBeInTheDocument();
  });

  it("supports keyboard selection in the note link autocomplete", async () => {
    const api = seededHcb();
    api.notes.linkSuggest = vi.fn(async () =>
      ok({
        items: [
          { kind: "note" as const, id: "note-project", label: "Project plan" },
          { kind: "task" as const, id: "task-plan", label: "Project plan task" },
          { kind: "event" as const, id: "event-plan", label: "Project plan review" }
        ]
      })
    );
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Notes");
    await user.click(await screen.findByText("Startup data flow"));
    await user.click(
      within(screen.getByTestId("inspector-actions")).getByRole("button", { name: "Edit" })
    );
    const bodyInput = await screen.findByRole("textbox", { name: "Note body" });
    const linkInput = screen.getByRole("combobox", { name: "Planner link target" });

    await user.type(linkInput, "plan");
    expect(await screen.findByRole("option", { name: /Project plan task/ })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(api.notes.linkSuggest).toHaveBeenCalledWith({ query: "plan", limit: 8 });
    expect((bodyInput as HTMLTextAreaElement).value).toContain("[[task:Project plan task]]");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("repairs broken note links from the note inspector", async () => {
    const api = seededHcb();
    api.notes.get = vi.fn(async ({ id }) =>
      ok({
        id,
        listId: "note-list:default",
        listTitle: "Notes",
        title: "Startup data flow",
        preview: "See [[Missing note]]",
        body: "See [[Missing note]]",
        updatedAt: now
      })
    );
    api.notes.listBrokenLinks = vi.fn(async () => ok({ items: [{ linkText: "Missing note" }] }));
    api.notes.linkSuggest = vi.fn(async (request) =>
      ok({
        items: request.query.toLowerCase().includes("replacement")
          ? [{ kind: "note" as const, id: "note-replacement", label: "Replacement note" }]
          : []
      })
    );
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Notes");
    await user.click(await screen.findByText("Startup data flow"));
    await user.click(
      within(screen.getByTestId("inspector-actions")).getByRole("button", { name: "Edit" })
    );
    const bodyInput = await screen.findByRole("textbox", { name: "Note body" });

    await user.click(await screen.findByRole("button", { name: "Fix link Missing note" }));
    const linkInput = screen.getByRole("combobox", { name: "Planner link target" });
    await user.clear(linkInput);
    await user.type(linkInput, "replacement");
    await user.click(await screen.findByRole("option", { name: /Replacement note/ }));

    expect((bodyInput as HTMLTextAreaElement).value).toContain("[[note:Replacement note]]");
    expect((bodyInput as HTMLTextAreaElement).value).not.toContain("[[Missing note]]");
  });
});
