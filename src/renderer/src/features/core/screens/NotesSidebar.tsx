import { CalendarPlus, Check, Pencil, Plus } from "lucide-react";
import { Button, cx } from "../../../components/primitives";
import {
  actionDescription,
  actionLabel
} from "../coreScreenShared";
import type { NoteBoardSelection } from "./notesTypes";

export function NotesSidebar({
  allNoteCount,
  onCreateDailyNote,
  onCreateMeetingNote,
  onCreateNote,
  onToggleView,
  selectedNoteViews,
  starredNoteCount
}: {
  allNoteCount: number;
  onCreateDailyNote: () => void;
  onCreateMeetingNote: () => void;
  onCreateNote: () => void;
  onToggleView: (view: NoteBoardSelection) => void;
  selectedNoteViews: NoteBoardSelection[];
  starredNoteCount: number;
}): JSX.Element {
  return (
    <aside className="min-h-0 rounded-hcbLg bg-bg-secondary p-3" aria-label="Notes navigation">
      <Button
        aria-label={actionLabel("note.create")}
        className="h-12 min-w-32 justify-start rounded-hcbLg shadow-sm"
        data-action-id="note.create"
        onClick={onCreateNote}
        title={actionDescription("note.create")}
        variant="secondary"
      >
        <Plus aria-hidden="true" size={18} />
        Create
      </Button>
      <div className="mt-5 grid gap-1">
        <NoteSidebarCheckbox
          checked={selectedNoteViews.includes("all")}
          count={allNoteCount}
          label="All notes"
          onClick={() => onToggleView("all")}
        />
        <NoteSidebarCheckbox
          checked={selectedNoteViews.includes("starred")}
          count={starredNoteCount}
          label="Starred"
          onClick={() => onToggleView("starred")}
        />
      </div>
      <div className="mt-5 grid gap-1">
        <Button className="justify-start" onClick={onCreateDailyNote} variant="ghost">
          <CalendarPlus aria-hidden="true" size={16} />
          Daily note
        </Button>
        <Button className="justify-start" onClick={onCreateMeetingNote} variant="ghost">
          <Pencil aria-hidden="true" size={16} />
          Meeting note
        </Button>
      </div>
    </aside>
  );
}

function NoteSidebarCheckbox({
  checked,
  count,
  label,
  onClick
}: {
  checked: boolean;
  count: number;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cx(
        "grid h-9 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-hcbLg px-2 text-left transition-colors duration-fast ease-hcb focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        checked ? "text-text-primary" : "text-text-secondary hover:bg-surface-0 hover:text-text-primary"
      )}
      onClick={onClick}
      role="checkbox"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cx(
          "flex size-4 items-center justify-center rounded-[4px] border",
          checked ? "border-accent bg-accent text-bg-primary" : "border-text-muted bg-transparent"
        )}
      >
        {checked ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className="truncate text-[var(--text-base)] font-medium">{label}</span>
      <span className="text-[var(--text-xs)] text-text-muted">{count}</span>
    </button>
  );
}
