import { useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { SettingsSnapshot } from "@shared/ipc/contracts";
import appIconUrl from "../../../../../assets/brand/buns-app-icon-sidebar.png";
import { Badge, cx } from "../../components/primitives";
import type { SectionId } from "../../data/mockPlanner";
import { displayAccelerator } from "../core/hotkeys";
import type { CoreViewModelSource } from "../core/coreViewModelSource";
import { scheduleFrame, sectionMetric } from "./shellUtils";
import type { VisiblePrimarySection } from "./types";

export function AppSidebar({
  activeSectionId,
  healthLabel,
  onNavigateToSection,
  sidebarOnRight,
  source,
  visiblePrimarySections
}: {
  activeSectionId: SectionId;
  healthLabel: string;
  onNavigateToSection: (sectionId: SectionId) => void;
  sidebarOnRight: boolean;
  source: CoreViewModelSource;
  visiblePrimarySections: VisiblePrimarySection[];
}): JSX.Element {
  const sectionButtonRefs = useRef(new Map<SectionId, HTMLButtonElement>());

  const setSectionButtonRef = useCallback(
    (sectionId: SectionId) =>
      (node: HTMLButtonElement | null): void => {
        if (node) {
          sectionButtonRefs.current.set(sectionId, node);
        } else {
          sectionButtonRefs.current.delete(sectionId);
        }
      },
    []
  );

  const focusSection = useCallback(
    (sectionId: SectionId): void => {
      onNavigateToSection(sectionId);
      sectionButtonRefs.current.get(sectionId)?.focus();
      scheduleFrame(() => sectionButtonRefs.current.get(sectionId)?.focus());
    },
    [onNavigateToSection]
  );

  function handleNavigationKeyDown(event: KeyboardEvent<HTMLButtonElement>, sectionId: SectionId): void {
    const currentIndex = visiblePrimarySections.findIndex(({ section }) => section.id === sectionId);
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = Math.min(currentIndex + 1, visiblePrimarySections.length - 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = Math.max(currentIndex - 1, 0);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = visiblePrimarySections.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    focusSection(visiblePrimarySections[nextIndex]?.section.id ?? sectionId);
  }

  return (
    <aside
      className={cx(
        "flex min-h-0 min-w-0 flex-row items-center overflow-x-auto border-b border-border bg-bg-secondary md:flex-col md:items-stretch md:overflow-hidden md:border-b-0",
        sidebarOnRight ? "md:order-2 md:border-l" : "md:order-1 md:border-r"
      )}
      id="app-sidebar"
      style={{ fontFamily: "var(--font-family-sidebar)", fontSize: "var(--text-sidebar)" }}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center border-r border-border px-3 md:w-auto md:border-b md:border-r-0 lg:justify-start lg:gap-3 lg:px-4">
        <img
          alt=""
          aria-hidden="true"
          className="size-8 rounded-hcbMd object-cover"
          draggable={false}
          src={appIconUrl}
        />
        <div className="hidden min-w-0 lg:block">
          <div className="truncate text-[var(--text-md)] font-semibold">Hot Cross Buns 2</div>
        </div>
      </div>

      <nav aria-label="Primary" className="flex min-h-0 min-w-0 flex-1 gap-1 overflow-x-auto px-2 py-2 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:py-3">
        {visiblePrimarySections.map(({ section, shortcutKey }) => {
          const Icon = section.icon;
          const selected = section.id === activeSectionId;

          return (
            <button
              aria-current={selected ? "page" : undefined}
              aria-keyshortcuts={`Meta+${shortcutKey} Control+${shortcutKey}`}
              aria-label={section.label}
              className={cx(
                "flex h-9 w-auto min-w-9 items-center justify-center gap-3 rounded-hcbMd px-2 text-left text-[var(--text-base)] transition-colors duration-fast ease-hcb focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:w-full lg:justify-start lg:px-3",
                selected
                  ? "bg-surface-0 text-text-primary"
                  : "text-text-secondary hover:bg-surface-0 hover:text-text-primary"
              )}
              key={section.id}
              onClick={() => onNavigateToSection(section.id)}
              onKeyDown={(event) => handleNavigationKeyDown(event, section.id)}
              ref={setSectionButtonRef(section.id)}
              title={`${section.label} (Cmd ${shortcutKey})`}
              type="button"
            >
              <Icon aria-hidden="true" className="shrink-0" size={16} strokeWidth={2} />
              <span className="hidden min-w-0 flex-1 truncate lg:inline">{section.label}</span>
              <span
                aria-hidden="true"
                className="hidden shrink-0 rounded-hcbSm border border-border px-1.5 font-mono text-[var(--text-xs)] text-text-muted lg:inline-flex"
              >
                {displayAccelerator(source.settings.keybindings[`navigation.${section.id}` as keyof SettingsSnapshot["keybindings"]])}
              </span>
              <span className="hidden shrink-0 text-[var(--text-xs)] text-text-muted lg:inline">
                {sectionMetric(source, section.id)}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="hidden border-t border-border px-4 py-3 text-[var(--text-xs)] text-text-muted lg:block">
        <div className="flex items-center justify-between gap-3">
          <span>Runtime</span>
          <Badge tone={healthLabel === "Ready" ? "success" : "neutral"}>{healthLabel}</Badge>
        </div>
      </div>
    </aside>
  );
}
