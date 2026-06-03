import { Children, isValidElement, useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { EmptyState } from "../../components/states";
import { cx } from "../../components/primitives";

export interface MarkdownPreviewProps {
  ariaLabel?: string;
  body: string;
  className?: string;
  emptyDescription?: string;
  emptyTitle?: string;
  variant?: "card" | "plain";
}

function safeHref(href: string | undefined): string | undefined {
  const trimmed = href?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

function safeImageSrc(src: string | undefined): string | undefined {
  const trimmed = src?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (/^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:/i.test(trimmed) || (trimmed.startsWith("/") && !trimmed.startsWith("//"))) {
    return trimmed;
  }

  return undefined;
}

function markdownChildrenToString(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("");
}

type MermaidState =
  | { kind: "loading" }
  | { kind: "rendered"; bindFunctions?: (element: Element) => void; svg: string }
  | { error: string; kind: "error" };

let mermaidSequence = 0;

function MermaidDiagram({
  chart
}: {
  chart: string;
  "data-mermaid-diagram"?: boolean;
}): JSX.Element {
  const [state, setState] = useState<MermaidState>({ kind: "loading" });
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    setState({ kind: "loading" });
    void import("mermaid")
      .then(async (module) => {
        const mermaid = module.default;
        const renderId = `hcb-mermaid-${reactId}-${mermaidSequence += 1}`;

        mermaid.initialize({ securityLevel: "strict", startOnLoad: false });
        const result = await mermaid.render(renderId, chart);

        if (!cancelled) {
          setState({
            bindFunctions: result.bindFunctions,
            kind: "rendered",
            svg: result.svg
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            error: error instanceof Error ? error.message : "Unable to render Mermaid diagram.",
            kind: "error"
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  useEffect(() => {
    if (state.kind === "rendered" && container) {
      state.bindFunctions?.(container);
    }
  }, [container, state]);

  if (state.kind === "loading") {
    return (
      <div
        className="grid min-h-24 place-items-center rounded-hcbMd border border-border bg-bg-tertiary px-3 py-4 text-[var(--text-sm)] text-text-muted"
        data-mermaid-diagram="true"
      >
        Rendering diagram...
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="grid gap-2 rounded-hcbMd border border-border bg-bg-tertiary p-3" data-mermaid-diagram="true">
        <div className="text-[var(--text-sm)] font-medium text-danger">Mermaid diagram failed to render.</div>
        <div className="text-[var(--text-xs)] text-text-muted">{state.error}</div>
        <pre className="overflow-auto rounded-hcbMd border border-border bg-surface-0 p-3 text-[var(--text-sm)]">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      className="flex justify-center overflow-auto rounded-hcbMd border border-border bg-bg-tertiary p-3 [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: state.svg }}
      data-mermaid-diagram="true"
      data-testid="mermaid-diagram"
      ref={setContainer}
    />
  );
}

function isMermaidCodeElement(children: ReactNode): boolean {
  const childArray = Children.toArray(children);

  if (childArray.length !== 1 || !isValidElement(childArray[0])) {
    return false;
  }

  const props = childArray[0].props as { className?: string; "data-mermaid-diagram"?: boolean };

  return props["data-mermaid-diagram"] === true || /\blanguage-mermaid\b/.test(props.className ?? "");
}

export function MarkdownPreview({
  ariaLabel = "Markdown preview",
  body,
  className,
  emptyDescription = "This note has no body yet.",
  emptyTitle = "Empty note",
  variant = "card"
}: MarkdownPreviewProps): JSX.Element {
  const [lightboxImage, setLightboxImage] = useState<{ alt: string; src: string; title?: string } | null>(null);

  useEffect(() => {
    if (!lightboxImage) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage]);

  const components: Components = {
    a({ children, href }) {
      const sanitizedHref = safeHref(href);

      return (
        <a
          className="text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href={sanitizedHref}
          rel="noreferrer"
          target={sanitizedHref?.startsWith("#") ? undefined : "_blank"}
        >
          {children}
        </a>
      );
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-accent pl-3 text-text-secondary">
          {children}
        </blockquote>
      );
    },
    del({ children }) {
      return <del className="text-text-muted">{children}</del>;
    },
    h1({ children }) {
      return <h1 className="text-[var(--text-xl)] font-semibold leading-snug">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-[var(--text-lg)] font-semibold leading-snug">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-[var(--text-md)] font-semibold leading-snug">{children}</h3>;
    },
    h4({ children }) {
      return <h4 className="font-semibold leading-snug">{children}</h4>;
    },
    hr() {
      return <hr className="border-border" />;
    },
    input(props) {
      return (
        <input
          checked={props.checked}
          className="mr-2 align-middle accent-[var(--color-accent)]"
          readOnly
          type="checkbox"
        />
      );
    },
    li({ children }) {
      return <li className="pl-1">{children}</li>;
    },
    img({ alt, src, title }) {
      const sanitizedSrc = safeImageSrc(src);
      const imageAlt = alt ?? "";

      if (!sanitizedSrc) {
        return (
          <span className="inline-flex rounded-hcbSm border border-border bg-bg-tertiary px-2 py-1 text-[var(--text-xs)] text-text-muted">
            {imageAlt ? `Blocked image: ${imageAlt}` : "Blocked image"}
          </span>
        );
      }

      return (
        <span className="my-2 flex justify-center">
          <button
            aria-label={imageAlt ? `Open image preview: ${imageAlt}` : "Open image preview"}
            className="max-w-full rounded-hcbMd focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => setLightboxImage({ alt: imageAlt, src: sanitizedSrc, title })}
            type="button"
          >
            <img
              alt={imageAlt}
              className="max-h-[min(520px,70vh)] max-w-full rounded-hcbMd border border-border object-contain shadow-hcbSm"
              loading="lazy"
              src={sanitizedSrc}
              title={title}
            />
          </button>
        </span>
      );
    },
    ol({ children }) {
      return <ol className="list-decimal space-y-1 pl-5">{children}</ol>;
    },
    p({ children }) {
      return <p>{children}</p>;
    },
    pre({ children }) {
      if (isMermaidCodeElement(children)) {
        return <>{children}</>;
      }

      return (
        <pre className="overflow-auto rounded-hcbMd border border-border bg-bg-tertiary p-3 text-[var(--text-sm)]">
          {children}
        </pre>
      );
    },
    code({ children, className: codeClassName }) {
      const source = markdownChildrenToString(children).replace(/\n$/, "");

      if (/\blanguage-mermaid\b/.test(codeClassName ?? "")) {
        return <MermaidDiagram chart={source} data-mermaid-diagram />;
      }

      return (
        <code
          className={cx(
            "rounded-hcbSm border border-border bg-bg-tertiary px-1 py-0.5 font-mono text-[0.92em] text-text-primary",
            codeClassName
          )}
        >
          {children}
        </code>
      );
    },
    table({ children }) {
      return (
        <div className="overflow-auto rounded-hcbMd border border-border bg-surface-0">
          <table className="min-w-full border-collapse text-left text-[var(--text-sm)]">
            {children}
          </table>
        </div>
      );
    },
    td({ children }) {
      return <td className="border-t border-border px-2 py-1 align-top">{children}</td>;
    },
    th({ children }) {
      return <th className="border-b border-border bg-bg-tertiary px-2 py-1 font-semibold">{children}</th>;
    },
    ul({ children }) {
      return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
    }
  };

  if (body.trim().length === 0) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cx(
        "grid content-start gap-2 text-[var(--text-base)] leading-relaxed text-text-secondary",
        variant === "card" && "min-h-[260px] rounded-hcbMd border border-border bg-surface-0 px-3 py-2",
        className
      )}
      role="region"
    >
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {body}
      </ReactMarkdown>
      {lightboxImage ? (
        <div
          aria-label="Image preview"
          aria-modal="true"
          className="fixed inset-0 z-[70] grid place-items-center bg-bg-primary/80 p-6 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
          role="dialog"
        >
          <div
            className="relative grid max-h-[calc(100dvh-48px)] max-w-[calc(100vw-48px)] gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label="Close image preview"
              className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-hcbMd border border-border bg-bg-secondary text-text-primary shadow-hcbSm transition-colors duration-fast ease-hcb hover:bg-surface-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => setLightboxImage(null)}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
            <img
              alt={lightboxImage.alt}
              className="max-h-[calc(100dvh-96px)] max-w-[calc(100vw-96px)] rounded-hcbMd border border-border bg-bg-tertiary object-contain shadow-hcbLg"
              src={lightboxImage.src}
              title={lightboxImage.title}
            />
            {lightboxImage.alt ? (
              <div className="max-w-[calc(100vw-96px)] truncate text-center text-[var(--text-sm)] text-text-secondary">
                {lightboxImage.alt}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
