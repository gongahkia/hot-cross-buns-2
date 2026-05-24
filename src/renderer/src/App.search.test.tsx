import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  goToSection,
  installHcb,
  runPaletteCommand,
  seededHcb
} from "./test/appTestHelpers";

describe("App search", () => {
  it("renders search results for task, event, note, and empty local queries", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Search");
    const input = screen.getByRole("textbox", { name: "Search local cache" });

    await user.type(input, "review");
    expect(await screen.findByText("Renderer acceptance review")).toBeInTheDocument();
    expect(screen.getByText(/hotcrossbuns:\/\/calendar\/event-review/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "cache");
    expect(await screen.findByText("Cache-first startup")).toBeInTheDocument();
    expect(screen.getByText(/hotcrossbuns:\/\/notes\/note-cache-first/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "missing");
    expect(await screen.findByText("No matching results")).toBeInTheDocument();
    expect(api.search.query).toHaveBeenLastCalledWith({ query: "missing", limit: 30 });
  });

  it("shows structured local search filters and keeps search on the local IPC path", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText("Local cache ready")).toBeInTheDocument();
    await goToSection("Search");

    vi.mocked(api.search.query).mockClear();
    vi.mocked(api.tasks.list).mockClear();
    vi.mocked(api.calendar.listEvents).mockClear();
    vi.mocked(api.notes.list).mockClear();

    const input = screen.getByRole("textbox", { name: "Search local cache" });
    const query = "source:tasks status:open due:today priority:high list:Inbox notes:yes triage";

    await user.type(input, query);

    expect(screen.getByText("Source: tasks")).toBeInTheDocument();
    expect(screen.getByText("Status: active")).toBeInTheDocument();
    expect(screen.getByText("Due: today")).toBeInTheDocument();
    expect(screen.getByText("Priority: high")).toBeInTheDocument();
    expect(screen.getByText("List: Inbox")).toBeInTheDocument();
    expect(await screen.findByText("Body: yes")).toBeInTheDocument();

    await waitFor(() => {
      expect(api.search.query).toHaveBeenCalledWith({ query, limit: 30 });
    });
    expect(api.tasks.list).not.toHaveBeenCalled();
    expect(api.calendar.listEvents).not.toHaveBeenCalled();
    expect(api.notes.list).not.toHaveBeenCalled();
  });

  it("saves structured local search views through settings", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Search");
    const input = screen.getByRole("textbox", { name: "Search local cache" });
    const query = "source:tasks status:open triage";

    await user.type(input, query);
    await user.type(screen.getByRole("textbox", { name: "Saved search name" }), "Open triage");
    await user.click(screen.getByRole("button", { name: "Save search" }));

    await waitFor(() => {
      expect(api.settings.update).toHaveBeenCalledWith({
        savedSearchViews: [
          expect.objectContaining({
            name: "Open triage",
            query
          })
        ]
      });
    });
    const savedViews = screen.getByRole("list", { name: "Saved search views" });
    const savedViewButton = within(savedViews).getAllByRole("button", { name: /Open triage/ })[0];
    expect(savedViewButton).toBeInTheDocument();

    await user.clear(input);
    await user.click(savedViewButton);
    expect(input).toHaveValue(query);
  });

  it("shows invalid search syntax inline without executing a search", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await goToSection("Search");
    vi.mocked(api.search.query).mockClear();

    await user.type(screen.getByRole("textbox", { name: "Search local cache" }), "status:blocked triage");

    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported task status");
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    expect(api.search.query).not.toHaveBeenCalled();
  });

  it("discovers structured search syntax through the command palette", async () => {
    installHcb(seededHcb());
    const user = userEvent.setup();
    render(<App />);

    await runPaletteCommand(user, "source:tasks", /Search filter syntax/);

    expect(screen.getByRole("heading", { level: 1, name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search local cache" })).toHaveValue(
      "source:tasks status:active due:today"
    );
  });
});
