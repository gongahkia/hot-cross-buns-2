import { ArrowLeft, ExternalLink, Globe2, PanelRightClose, X } from "lucide-react";
import { Button } from "../../components/primitives";
import { getPlannerSection, type SectionId } from "../../data/mockPlanner";
import { SectionContent } from "../core/CoreScreens";

export interface SplitPaneWebPage {
  id: string;
  title: string;
  url: string;
}

export type SplitPaneSelection =
  | { kind: "section"; sectionId: SectionId }
  | { kind: "web"; pageId: string };

function splitPaneUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

export function SplitPane({
  availableSectionIds,
  onBack,
  onClose,
  onSelectSection,
  onSelectWebPage,
  recentWebPages,
  selected,
  visibleCalendarIds
}: {
  availableSectionIds: SectionId[];
  onBack: () => void;
  onClose: () => void;
  onSelectSection: (sectionId: SectionId) => void;
  onSelectWebPage: (pageId: string) => void;
  recentWebPages: SplitPaneWebPage[];
  selected: SplitPaneSelection | null;
  visibleCalendarIds: ReadonlySet<string>;
}): JSX.Element {
  const selectedPage =
    selected?.kind === "web"
      ? recentWebPages.find((page) => page.id === selected.pageId) ?? null
      : null;
  const selectedSection =
    selected?.kind === "section" ? getPlannerSection(selected.sectionId) : null;
  const title = selectedPage?.title ?? selectedSection?.title ?? "Choose split view";

  return (
    <aside
      aria-label="Split view"
      className="flex min-h-0 min-w-[360px] max-w-[720px] flex-[0_0_42%] flex-col border-l border-border bg-bg-primary"
      data-testid="split-pane"
    >
      <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          {selected ? (
            <Button aria-label="Choose split view" className="size-8 px-0" onClick={onBack} title="Choose split view" variant="ghost">
              <ArrowLeft aria-hidden="true" size={15} />
            </Button>
          ) : (
            <PanelRightClose aria-hidden="true" className="text-text-muted" size={17} />
          )}
          <h2 className="truncate text-[var(--text-md)] font-semibold text-text-primary">{title}</h2>
        </div>
        <Button aria-label="Close split view" className="size-8 px-0" onClick={onClose} title="Close split view" variant="ghost">
          <X aria-hidden="true" size={15} />
        </Button>
      </div>

      {selectedPage ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-9 items-center gap-2 border-b border-border px-3 text-[var(--text-xs)] text-text-muted">
            <Globe2 aria-hidden="true" size={14} />
            <span className="truncate">{selectedPage.url}</span>
          </div>
          <webview
            className="min-h-0 flex-1 bg-bg-primary"
            data-testid="split-webview"
            partition="persist:hcb-split-pane"
            src={selectedPage.url}
            webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
          />
        </div>
      ) : selectedSection ? (
        <section className="min-h-0 flex-1 overflow-auto p-2 sm:p-3" aria-label={`${selectedSection.title} split content`}>
          <SectionContent
            activeSectionId={selectedSection.id}
            taskCommand={null}
            visibleCalendarIds={visibleCalendarIds}
          />
        </section>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid gap-5">
            <section className="grid gap-2">
              <h3 className="text-[var(--text-sm)] font-semibold uppercase text-text-muted">Recent webpages</h3>
              {recentWebPages.length > 0 ? (
                <div className="grid gap-2">
                  {recentWebPages.map((page) => (
                    <button
                      className="grid min-h-14 min-w-0 gap-1 rounded-hcbMd border border-border bg-bg-secondary px-3 py-2 text-left transition-colors duration-fast ease-hcb hover:bg-surface-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      key={page.id}
                      onClick={() => onSelectWebPage(page.id)}
                      type="button"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2 text-[var(--text-base)] font-medium text-text-primary">
                        <ExternalLink aria-hidden="true" className="shrink-0 text-text-muted" size={15} />
                        <span className="truncate">{page.title}</span>
                      </span>
                      <span className="truncate text-[var(--text-xs)] text-text-muted">{splitPaneUrlLabel(page.url)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-hcbMd border border-dashed border-border px-3 py-4 text-[var(--text-sm)] text-text-muted">
                  No webpages opened in Hot Cross Buns yet.
                </p>
              )}
            </section>

            <section className="grid gap-2">
              <h3 className="text-[var(--text-sm)] font-semibold uppercase text-text-muted">App tabs</h3>
              <div className="grid gap-2">
                {availableSectionIds.map((sectionId) => {
                  const section = getPlannerSection(sectionId);
                  const Icon = section.icon;

                  return (
                    <button
                      className="flex min-h-12 min-w-0 items-center gap-3 rounded-hcbMd border border-border bg-bg-secondary px-3 py-2 text-left transition-colors duration-fast ease-hcb hover:bg-surface-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      key={sectionId}
                      onClick={() => onSelectSection(sectionId)}
                      type="button"
                    >
                      <Icon aria-hidden="true" className="shrink-0 text-text-muted" size={17} />
                      <span className="min-w-0">
                        <span className="block truncate text-[var(--text-base)] font-medium text-text-primary">{section.title}</span>
                        <span className="block truncate text-[var(--text-xs)] text-text-muted">{section.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </aside>
  );
}
