import { useState } from "react";
import { MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import { Badge, IconButton, Panel, cx } from "../../../components/primitives";
import { EmptyState } from "../../../components/states";
import { VirtualizedList } from "../../../components/VirtualizedList";
import type { NoteViewModel } from "../coreViewModels";
import type { NoteViewColumn } from "./notesTypes";

export function NotesBoard({
  allNoteCount,
  columns,
  onDeleteNote,
  onOpenNote,
  onToggleStar,
  selectedNoteId,
  starredNoteIds
}: {
  allNoteCount: number;
  columns: NoteViewColumn[];
  onDeleteNote: (noteId: string) => void;
  onOpenNote: (noteId: string, mode?: "view" | "edit") => void;
  onToggleStar: (noteId: string) => void;
  selectedNoteId: string | null;
  starredNoteIds: ReadonlySet<string>;
}): JSX.Element {
  return (
    <div className="min-h-0 min-w-0 overflow-hidden rounded-hcbLg bg-bg-secondary">
      <div
        className="flex h-full min-h-[480px] min-w-0 gap-3 overflow-x-auto p-3"
        role="list"
        aria-label="Note views"
      >
        {columns.length > 0 ? (
          columns.map((column) => (
            <Panel
              action={<Badge tone="neutral">{column.id === "all" ? allNoteCount : column.notes.length}</Badge>}
              className="flex max-h-full w-[min(520px,calc(100vw-2rem))] shrink-0 flex-col overflow-hidden bg-bg-primary"
              description={column.description}
              key={column.id}
              role="listitem"
              title={column.title}
            >
              <VirtualizedList
                ariaLabel={column.title}
                emptyState={
                  <EmptyState
                    description={column.emptyDescription}
                    title={column.emptyTitle}
                  />
                }
                estimateRowHeight={66}
                getKey={(note) => note.id}
                items={column.notes}
                performanceLabel={`notes.${column.id}.list`}
                renderRow={(note) => (
                  <NoteBoardRow
                    key={note.id}
                    note={note}
                    onDeleteNote={onDeleteNote}
                    onOpenNote={onOpenNote}
                    onToggleStar={onToggleStar}
                    selected={note.id === selectedNoteId}
                    starred={starredNoteIds.has(note.id)}
                  />
                )}
                viewportHeight={520}
              />
            </Panel>
          ))
        ) : (
          <div className="grid min-h-[360px] min-w-80 flex-1 place-items-center rounded-hcbLg border border-border bg-bg-primary">
            <EmptyState
              description="Select at least one note view from the sidebar to show it here."
              title="No visible note views"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function NoteBoardRow({
  note,
  onDeleteNote,
  onOpenNote,
  onToggleStar,
  selected,
  starred
}: {
  note: NoteViewModel;
  onDeleteNote: (noteId: string) => void;
  onOpenNote: (noteId: string, mode?: "view" | "edit") => void;
  onToggleStar: (noteId: string) => void;
  selected: boolean;
  starred: boolean;
}): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cx(
        "group relative grid min-h-[66px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 transition-colors duration-fast ease-hcb",
        selected ? "bg-surface-0" : "bg-transparent hover:bg-surface-0"
      )}
      role="listitem"
    >
      <button
        aria-current={selected ? "true" : undefined}
        aria-label={`Open note ${note.title}`}
        className="min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => onOpenNote(note.id)}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[var(--text-md)] font-medium text-text-primary">
            {note.title}
          </span>
          <span className="shrink-0 text-[var(--text-xs)] text-text-muted">
            {note.updatedLabel}
          </span>
        </div>
        <p className="truncate text-[var(--text-sm)] text-text-muted">{note.preview}</p>
      </button>
      <div
        className={cx(
          "relative flex items-center gap-1 transition-opacity duration-fast ease-hcb group-focus-within:opacity-100 group-hover:opacity-100",
          starred || menuOpen ? "opacity-100" : "opacity-0"
        )}
      >
        <IconButton
          className="size-7 rounded-full"
          icon={MoreVertical}
          label={`Open actions for ${note.title}`}
          onClick={() => setMenuOpen((open) => !open)}
          variant="ghost"
        />
        <IconButton
          className={cx("size-7 rounded-full", starred ? "text-accent [&_svg]:fill-current" : undefined)}
          icon={Star}
          label={starred ? `Unstar ${note.title}` : `Star ${note.title}`}
          onClick={() => onToggleStar(note.id)}
          variant="ghost"
        />
        {menuOpen ? (
          <NoteActionMenu
            onDelete={() => {
              onDeleteNote(note.id);
              setMenuOpen(false);
            }}
            onEdit={() => {
              onOpenNote(note.id, "edit");
              setMenuOpen(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function NoteActionMenu({
  onDelete,
  onEdit
}: {
  onDelete: () => void;
  onEdit: () => void;
}): JSX.Element {
  return (
    <div className="absolute right-0 top-8 z-30 w-56 overflow-hidden rounded-hcbLg border border-border bg-bg-primary py-2 shadow-xl">
      <button
        className="flex min-h-9 w-full items-center gap-3 px-4 text-left text-[var(--text-base)] text-text-primary transition-colors duration-fast ease-hcb hover:bg-surface-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={onEdit}
        type="button"
      >
        <Pencil aria-hidden="true" size={18} />
        Edit note
      </button>
      <button
        className="flex min-h-9 w-full items-center gap-3 px-4 text-left text-[var(--text-base)] text-danger transition-colors duration-fast ease-hcb hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={onDelete}
        type="button"
      >
        <Trash2 aria-hidden="true" size={18} />
        Delete
      </button>
    </div>
  );
}
