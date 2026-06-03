import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn()
}));

vi.mock("mermaid", () => ({
  default: mermaidMock
}));

describe("MarkdownPreview", () => {
  beforeEach(() => {
    mermaidMock.initialize.mockReset();
    mermaidMock.render.mockReset();
    mermaidMock.render.mockResolvedValue({
      svg: '<svg data-testid="mermaid-svg" role="img" aria-label="Rendered diagram"></svg>'
    });
  });

  it("renders markdown images centered and opens a lightbox", async () => {
    const user = userEvent.setup();

    render(<MarkdownPreview body="![Roadmap](https://example.com/roadmap.png)" />);

    const image = screen.getByRole("img", { name: "Roadmap" });
    expect(image).toHaveAttribute("src", "https://example.com/roadmap.png");
    expect(image).toHaveClass("max-w-full");

    await user.click(screen.getByRole("button", { name: "Open image preview: Roadmap" }));

    const dialog = screen.getByRole("dialog", { name: "Image preview" });
    expect(within(dialog).getByRole("img", { name: "Roadmap" })).toHaveAttribute(
      "src",
      "https://example.com/roadmap.png"
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Image preview" })).not.toBeInTheDocument();
  });

  it("blocks unsafe markdown image URLs", () => {
    render(<MarkdownPreview body="![Bad](javascript:alert(1))" />);

    expect(screen.queryByRole("img", { name: "Bad" })).not.toBeInTheDocument();
    expect(screen.getByText("Blocked image: Bad")).toBeInTheDocument();
  });

  it("renders GFM tables", () => {
    render(<MarkdownPreview body={"| Field | Value |\n| --- | --- |\n| Owner | Design |"} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Field" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Design" })).toBeInTheDocument();
  });

  it("renders Mermaid diagrams from fenced code blocks", async () => {
    render(<MarkdownPreview body={"```mermaid\ngraph TD\nA-->B\n```"} />);

    const diagram = await screen.findByTestId("mermaid-diagram");

    expect(mermaidMock.initialize).toHaveBeenCalledWith({ securityLevel: "strict", startOnLoad: false });
    expect(mermaidMock.render).toHaveBeenCalledWith(expect.stringMatching(/^hcb-mermaid-/), "graph TD\nA-->B");
    expect(within(diagram).getByTestId("mermaid-svg")).toBeInTheDocument();
  });

  it("falls back to source code when Mermaid rendering fails", async () => {
    mermaidMock.render.mockRejectedValueOnce(new Error("Parse failed"));

    render(<MarkdownPreview body={"```mermaid\ngraph TD\nA-->B\n```"} />);

    expect(await screen.findByText("Mermaid diagram failed to render.")).toBeInTheDocument();
    expect(screen.getByText("Parse failed")).toBeInTheDocument();
    expect(screen.getByText(/graph TD/)).toBeInTheDocument();
  });
});
