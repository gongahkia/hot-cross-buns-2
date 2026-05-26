import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { installHcb, seededHcb } from "./test/appTestHelpers";

describe("Command palette search", () => {
  it("falls back to local search when the query matches no commands", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("{Meta>}p{/Meta}");
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    const input = within(dialog).getByRole("searchbox", { name: "Filter commands" });

    await user.type(input, "review");

    expect(await within(dialog).findByRole("option", { name: /Renderer acceptance review/ })).toBeInTheDocument();
    expect(api.search.query).toHaveBeenCalledWith({ query: "review", limit: 30 });
  });

  it("opens the matching section from a palette search result", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("{Meta>}p{/Meta}");
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });

    await user.type(within(dialog).getByRole("searchbox", { name: "Filter commands" }), "triage");
    await user.click(await within(dialog).findByRole("option", { name: /Draft inbox triage rules/ }));

    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
  });

  it("keeps command matches on the command path instead of searching", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("Local cache ready");
    vi.mocked(api.search.query).mockClear();

    await user.keyboard("{Meta>}p{/Meta}");
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });

    await user.type(within(dialog).getByRole("searchbox", { name: "Filter commands" }), "new task");

    expect(within(dialog).getByRole("option", { name: /New task/ })).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    expect(api.search.query).not.toHaveBeenCalled();
  });

  it("supports structured local search syntax inside the palette", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("Local cache ready");
    vi.mocked(api.search.query).mockClear();

    await user.keyboard("{Meta>}p{/Meta}");
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    const query = "source:tasks status:open due:today priority:high list:Inbox notes:yes triage";

    await user.type(within(dialog).getByRole("searchbox", { name: "Filter commands" }), query);

    expect(await within(dialog).findByRole("option", { name: /Draft inbox triage rules/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(api.search.query).toHaveBeenCalledWith({ query, limit: 30 });
    });
  });

  it("shows invalid search syntax without executing a search", async () => {
    const api = seededHcb();
    installHcb(api);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("Local cache ready");
    vi.mocked(api.search.query).mockClear();

    await user.keyboard("{Meta>}p{/Meta}");
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });

    await user.type(within(dialog).getByRole("searchbox", { name: "Filter commands" }), "status:blocked triage");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Unsupported task status");
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    expect(api.search.query).not.toHaveBeenCalled();
  });
});
