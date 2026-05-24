import { useState } from "react";
import type { SavedSearchView } from "@shared/ipc/contracts";
import {
  AlertTriangle,
  Bell,
  Brush,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Gift,
  Info,
  Keyboard,
  Languages,
  ListPlus,
  MapPin,
  Pencil,
  Filter,
  Minus,
  PanelLeft,
  PanelRight,
  Plus,
  Power,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  StepBack,
  StepForward,
  Search,
  Settings2,
  Trash2,
  Users,
  X
} from "lucide-react";
import { Badge, Button, IconButton, Input, ListRow, Panel, StatusBanner } from "../../../components/primitives";
import { EmptyState, ErrorState, LoadingState, OfflineState } from "../../../components/states";
import { VirtualizedList } from "../../../components/VirtualizedList";
import { useCoreViewModelSource, useLocalSearch } from "../coreViewModelSource";
import { sourceTone } from "../coreScreenShared";

function defaultSavedSearchName(query: string, existingCount: number): string {
  const textTerms = query
    .split(/\s+/)
    .filter((token) => token.length > 0 && !token.includes(":"))
    .slice(0, 4)
    .join(" ");

  if (textTerms) {
    return textTerms.length > 42 ? `${textTerms.slice(0, 39)}...` : textTerms;
  }

  return `Saved search ${existingCount + 1}`;
}

function nextSavedSearchViews(
  current: readonly SavedSearchView[],
  view: SavedSearchView
): SavedSearchView[] {
  const withoutMatchingQuery = current.filter(
    (savedView) => savedView.query.trim() !== view.query.trim()
  );

  return [view, ...withoutMatchingQuery].slice(0, 20);
}

function sanitizeInspectorDetails(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeInspectorDetails);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.toLowerCase();

    if (
      normalized.includes("token") ||
      normalized.includes("secret") ||
      normalized.includes("credential") ||
      normalized.includes("password") ||
      normalized.includes("path") ||
      normalized.includes("payload") ||
      normalized.includes("body")
    ) {
      result[key] = "[redacted]";
      continue;
    }

    result[key] = sanitizeInspectorDetails(entry);
  }

  return result;
}

function sanitizedJson(value: unknown): string {
  return JSON.stringify(sanitizeInspectorDetails(value), null, 2);
}

export function SearchView({
  query,
  setQuery
}: {
  query: string;
  setQuery: (query: string) => void;
}): JSX.Element {
  const source = useCoreViewModelSource();
  const search = useLocalSearch(query);
  const searchViewModel = search.viewModel;
  const [savedSearchName, setSavedSearchName] = useState("");
  const trimmedQuery = query.trim();
  const matchingSavedSearch = source.settings.savedSearchViews.find(
    (view) => view.query.trim() === trimmedQuery
  );
  const canSaveSearch =
    trimmedQuery.length > 0 &&
    search.parsed.errors.length === 0 &&
    !matchingSavedSearch &&
    !source.settingsMutationPending;

  async function saveSearchView(): Promise<void> {
    if (!canSaveSearch) {
      return;
    }

    const now = new Date().toISOString();
    const view: SavedSearchView = {
      id: `search-${Date.now()}`,
      name: savedSearchName.trim() || defaultSavedSearchName(trimmedQuery, source.settings.savedSearchViews.length),
      query: trimmedQuery,
      createdAt: now,
      updatedAt: now
    };
    const saved = await source.updateSettings({
      savedSearchViews: nextSavedSearchViews(source.settings.savedSearchViews, view)
    });

    if (saved) {
      setSavedSearchName("");
    }
  }

  function deleteSearchView(viewId: string): void {
    void source.updateSettings({
      savedSearchViews: source.settings.savedSearchViews.filter((view) => view.id !== viewId)
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          size={15}
        />
        <Input
          aria-label="Search local cache"
          className="pl-9"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks, events, and notes"
          value={query}
        />
      </div>

      {search.parsed.chips.length > 0 ? (
        <div aria-label="Parsed search filters" className="flex flex-wrap gap-2">
          {search.parsed.chips.map((chip) => (
            <Badge key={chip.id} tone="accent">
              {chip.label}: {chip.value}
            </Badge>
          ))}
        </div>
      ) : null}

      {search.parsed.errors.length > 0 ? (
        <div
          aria-live="polite"
          className="rounded-hcbMd border border-warning bg-bg-secondary px-3 py-2 text-[var(--text-sm)] text-warning"
          role="alert"
        >
          {search.parsed.errors[0]?.message ?? "Invalid search query."}
        </div>
      ) : null}

      <Panel
        action={
          <Button
            disabled={!canSaveSearch}
            onClick={() => void saveSearchView()}
            size="sm"
            variant="primary"
          >
            <Save aria-hidden="true" size={14} />
            Save search
          </Button>
        }
        title="Saved searches"
        description={`${source.settings.savedSearchViews.length} local views`}
      >
        <div className="grid gap-3 p-3">
          <Input
            aria-label="Saved search name"
            disabled={trimmedQuery.length === 0}
            onChange={(event) => setSavedSearchName(event.target.value)}
            placeholder={trimmedQuery ? defaultSavedSearchName(trimmedQuery, source.settings.savedSearchViews.length) : "Name current query"}
            value={savedSearchName}
          />
          {matchingSavedSearch ? (
            <StatusBanner
              description={matchingSavedSearch.query}
              title={`${matchingSavedSearch.name} is saved`}
              tone="success"
            />
          ) : null}
          {source.settings.savedSearchViews.length > 0 ? (
            <div className="grid gap-2" role="list" aria-label="Saved search views">
              {source.settings.savedSearchViews.map((view) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_32px] gap-2"
                  key={view.id}
                  role="listitem"
                >
                  <button
                    className="min-w-0 rounded-hcbMd border border-border bg-bg-tertiary px-3 py-2 text-left transition-colors duration-fast ease-hcb hover:bg-surface-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={() => setQuery(view.query)}
                    type="button"
                  >
                    <span className="block truncate text-[var(--text-sm)] font-medium text-text-primary">
                      {view.name}
                    </span>
                    <span className="block truncate font-mono text-[var(--text-xs)] text-text-muted">
                      {view.query}
                    </span>
                  </button>
                  <IconButton
                    icon={Trash2}
                    label={`Delete saved search ${view.name}`}
                    onClick={() => deleteSearchView(view.id)}
                    variant="danger"
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Save structured local searches once their filters are useful."
              title="No saved searches"
            />
          )}
        </div>
      </Panel>

      <Panel
        action={<Badge tone={searchViewModel.state === "results" ? "success" : "neutral"}>{searchViewModel.summary}</Badge>}
        title="Search results"
        description={
          search.state === "invalid"
            ? "Fix filter syntax to refresh local results"
            : search.state === "stale"
            ? "Refreshing local results"
            : "Capped SQLite-backed local results"
        }
      >
        {search.state === "loading" ? (
          <LoadingState description="Searching the local cache." title="Searching" />
        ) : search.state === "error" ? (
          <ErrorState description={search.errorMessage ?? "Search failed."} />
        ) : search.state === "offline" ? (
          <OfflineState description="Search requires the preload bridge." />
        ) : searchViewModel.state === "idle" ? (
          <EmptyState
            description="Type a query to search cached tasks, events, and notes."
            title="Search local cache"
          />
        ) : searchViewModel.state === "empty" ? (
          <EmptyState
            description="No cached tasks, events, or notes matched the query."
            title="No matching results"
          />
        ) : (
          <VirtualizedList
            ariaLabel="Search results"
            estimateRowHeight={60}
            getKey={(result) => result.id}
            items={searchViewModel.results}
            performanceLabel="search.results"
            renderRow={(result) => (
              <ListRow
                description={`${result.detail} - ${result.deepLinkLabel}`}
                title={result.title}
                trailing={<Badge tone={sourceTone(result.source)}>{result.source}</Badge>}
              />
            )}
            viewportHeight={356}
          />
        )}
      </Panel>
    </div>
  );
}
