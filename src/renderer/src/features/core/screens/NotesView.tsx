import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
import { useInspector } from "../../../components/Inspector";
import { Badge, Button, ListRow, Panel, cx } from "../../../components/primitives";
import { EmptyState } from "../../../components/states";
import { VirtualizedList } from "../../../components/VirtualizedList";
import { rendererNow, reportRendererTimingSince } from "../../../hooks/useRenderTiming";
import { useCoreViewModelSource } from "../coreViewModelSource";
import type { NoteViewModel } from "../coreViewModels";
import {
  NoteInspectorBody,
  type NoteDraftValue,
  type NoteInspectorBodyHandle
} from "../inspectors/NoteInspectorBody";
import { buildNotePreview } from "../notesParsing";
import {
  CacheStatePanel,
  TaskCompletionButton,
  actionDescription,
  actionLabel,
  dateInputValue,
  priorityLabel,
  priorityTone,
  scheduleRendererFrame
} from "../coreScreenShared";

function TaskNotesView(): JSX.Element {
  const source = useCoreViewModelSource();
  const undatedTasks = useMemo(
    () =>
      source.largeTaskWindow.filter(
        (task) =>
          task.status === "open" &&
          task.parentId === null &&
          !task.dueDate &&
          !task.plannedStart
      ),
    [source.largeTaskWindow]
  );

  if (
    (source.dataState === "loading" ||
      source.dataState === "offline" ||
      source.dataState === "error") &&
    !source.hasCachedData
  ) {
    return <CacheStatePanel title="Notes" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Panel
        title="Notes"
        description="Undated Google Tasks"
        action={<Badge tone="neutral">{undatedTasks.length}</Badge>}
      >
        {undatedTasks.length > 0 ? (
          <VirtualizedList
            ariaLabel="Undated task notes"
            estimateRowHeight={68}
            getKey={(task) => task.id}
            items={undatedTasks}
            performanceLabel="notes.undated-tasks"
            renderRow={(task) => (
              <ListRow
                description={task.detail}
                leading={
                  <TaskCompletionButton
                    completed={false}
                    onToggle={(taskId) => void source.completeTask(taskId)}
                    task={task}
                  />
                }
                meta={task.list}
                title={task.title}
                trailing={<Badge tone={priorityTone(task.priority)}>{priorityLabel(task.priority)}</Badge>}
              />
            )}
            viewportHeight={Math.min(560, Math.max(180, undatedTasks.length * 68))}
          />
        ) : (
          <EmptyState
            description="Google Tasks with no due date or planned block will appear here."
            title="No undated tasks"
          />
        )}
      </Panel>
    </div>
  );
}

export function NotesView(): JSX.Element {
  const source = useCoreViewModelSource();
  const {
    close: closeInspector,
    current: currentInspector,
    open: openInspector,
    update: updateInspector
  } = useInspector();
  const [notes, setNotes] = useState<NoteViewModel[]>(source.initialNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    source.initialNotes[0]?.id ?? null
  );
  const [draftCounter, setDraftCounter] = useState(1);
  const requestedNoteDetails = useRef(new Set<string>());
  const lastNoteEditReportAt = useRef(0);
  const noteInspectorBodyRef = useRef<NoteInspectorBodyHandle | null>(null);
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

  useEffect(() => {
    requestedNoteDetails.current.clear();
    setNotes(source.initialNotes);
    setSelectedNoteId((current) =>
      current && source.initialNotes.some((note) => note.id === current)
        ? current
        : source.initialNotes[0]?.id ?? null
    );
  }, [source.initialNotes]);

  useEffect(() => {
    if (
      !selectedNote ||
      selectedNote.id.startsWith("note-draft-") ||
      requestedNoteDetails.current.has(selectedNote.id)
    ) {
      return;
    }

    requestedNoteDetails.current.add(selectedNote.id);
    let cancelled = false;

    void window.hcb?.notes.get({ id: selectedNote.id }).then((result) => {
      if (cancelled || !result?.ok) {
        return;
      }

      setNotes((current) =>
        current.map((note) =>
          note.id === selectedNote.id
            ? {
                id: result.data.id,
                title: result.data.title,
                body: result.data.body,
                preview: result.data.preview,
                updatedLabel: note.updatedLabel
              }
            : note
        )
      );
    });

    return () => {
      cancelled = true;
    };
  }, [selectedNote?.id]);

  useEffect(() => {
    for (const note of notes) {
      if (
        note.id === selectedNote?.id ||
        note.id.startsWith("note-draft-") ||
        requestedNoteDetails.current.has(note.id)
      ) {
        continue;
      }

      requestedNoteDetails.current.add(note.id);
      void window.hcb?.notes.get({ id: note.id }).then((result) => {
        if (!result?.ok) {
          return;
        }

        setNotes((current) =>
          current.map((currentNote) =>
            currentNote.id === result.data.id
              ? {
                  id: result.data.id,
                  title: result.data.title,
                  body: result.data.body,
                  preview: result.data.preview,
                  updatedLabel: currentNote.updatedLabel
                }
              : currentNote
          )
        );
      });
    }
  }, [notes, selectedNote?.id]);

  useEffect(() => {
    function handleNoteCommand(event: Event): void {
      const detail = (event as CustomEvent<{ action: string }>).detail;

      if (detail?.action === "new-note") {
        void createNote();
      }
    }

    window.addEventListener("hcb:note-command", handleNoteCommand);
    return () => window.removeEventListener("hcb:note-command", handleNoteCommand);
  });

  useEffect(() => {
    if (currentInspector?.kind !== "note" || !selectedNote || currentInspector.id !== selectedNote.id) {
      return;
    }

    updateInspector({
      actions: noteInspectorActions(selectedNote),
      body: noteInspectorBody(selectedNote),
      subtitle: selectedNote.updatedLabel,
      title: selectedNote.title || "Untitled note"
    });
  }, [
    currentInspector?.id,
    currentInspector?.kind,
    notes,
    selectedNote,
    updateInspector
  ]);

  if (
    (source.dataState === "loading" ||
      source.dataState === "offline" ||
      source.dataState === "error") &&
    !source.hasCachedData
  ) {
    return <CacheStatePanel title="Notes" />;
  }

  function noteInspectorBody(note: NoteViewModel): ReactNode {
    return (
      <NoteInspectorBody
        key={note.id}
        note={note}
        notes={notes}
        onDraftChange={updateNoteDraft}
        onOpenNote={selectNote}
        onPersist={persistNoteDraft}
        ref={noteInspectorBodyRef}
      />
    );
  }

  function noteInspectorActions(note: NoteViewModel): ReactNode {
    return (
      <>
        <Button onClick={() => void deleteNote(note.id)} size="sm" variant="danger">
          <Trash2 aria-hidden="true" size={14} />
          Delete selected note
        </Button>
        <Button onClick={() => void closeInspector()} size="sm" variant="ghost">
          <X aria-hidden="true" size={14} />
          Close
        </Button>
      </>
    );
  }

  function openNoteInspector(note: NoteViewModel): void {
    openInspector({
      actions: noteInspectorActions(note),
      body: noteInspectorBody(note),
      dirty: false,
      id: note.id,
      kind: "note",
      onConfirmClose: async () => {
        await noteInspectorBodyRef.current?.flush();
        return true;
      },
      subtitle: note.updatedLabel,
      title: note.title || "Untitled note"
    });
  }

  async function selectNote(noteId: string): Promise<void> {
    const note = notes.find((candidate) => candidate.id === noteId);

    if (!note) {
      return;
    }

    await noteInspectorBodyRef.current?.flush();
    setSelectedNoteId(note.id);
    openNoteInspector(note);
  }

  async function createNote(): Promise<void> {
    await noteInspectorBodyRef.current?.flush();

    const fallbackId = `note-draft-${draftCounter}`;
    const fallbackNote: NoteViewModel = {
      id: fallbackId,
      title: "Untitled note",
      body: "",
      preview: "Empty local note",
      updatedLabel: "Just now"
    };

    setDraftCounter((current) => current + 1);
    setNotes((current) => [fallbackNote, ...current]);
    setSelectedNoteId(fallbackId);
    openNoteInspector(fallbackNote);

    const result = await window.hcb?.notes.create({
      title: "Untitled note",
      body: ""
    });

    if (result?.ok) {
      requestedNoteDetails.current.add(result.data.id);
      const persisted = {
        id: result.data.id,
        title: result.data.title,
        body: result.data.body,
        preview: result.data.preview,
        updatedLabel: "Just now"
      };

      setNotes((current) =>
        current.map((note) => (note.id === fallbackId ? persisted : note))
      );
      setSelectedNoteId(result.data.id);
      openNoteInspector(persisted);
    }
  }

  async function createNoteWithTemplate(title: string, body: string): Promise<void> {
    await noteInspectorBodyRef.current?.flush();

    const fallbackId = `note-draft-${draftCounter}`;
    const fallbackNote: NoteViewModel = {
      id: fallbackId,
      title,
      body,
      preview: buildNotePreview(body),
      updatedLabel: "Just now"
    };

    setDraftCounter((current) => current + 1);
    setNotes((current) => [fallbackNote, ...current]);
    setSelectedNoteId(fallbackId);
    openNoteInspector(fallbackNote);

    const result = await window.hcb?.notes.create({ title, body });

    if (result?.ok) {
      requestedNoteDetails.current.add(result.data.id);
      const persisted = {
        id: result.data.id,
        title: result.data.title,
        body: result.data.body,
        preview: result.data.preview,
        updatedLabel: "Just now"
      };

      setNotes((current) =>
        current.map((note) => (note.id === fallbackId ? persisted : note))
      );
      setSelectedNoteId(result.data.id);
      openNoteInspector(persisted);
    }
  }

  function createDailyNote(): void {
    const today = dateInputValue(new Date().toISOString());
    void createNoteWithTemplate(
      `Daily ${today}`,
      `status: open\ntags: daily\ndate: ${today}\n\n# Daily ${today}\n- [ ] Review calendar\n- [ ] Triage inbox\n`
    );
  }

  function createMeetingNote(): void {
    const today = dateInputValue(new Date().toISOString());
    void createNoteWithTemplate(
      `Meeting ${today}`,
      `status: draft\ntags: meeting\ndate: ${today}\n\n# Meeting ${today}\nAttendees:\n\nNotes:\n\nDecisions:\n- \n`
    );
  }

  function updateNoteDraft(noteId: string, draft: NoteDraftValue): void {
    const startedAt = rendererNow();
    setNotes((current) =>
      current.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        return {
          ...note,
          title: draft.title,
          body: draft.body,
          preview: buildNotePreview(draft.body),
          updatedLabel: "Edited locally"
        };
      })
    );

    if (startedAt !== null && startedAt - lastNoteEditReportAt.current > 250) {
      lastNoteEditReportAt.current = startedAt;
      scheduleRendererFrame(() => {
        reportRendererTimingSince("notes.edit.local", startedAt, {
          field: "body",
          noteCount: notes.length
        });
      });
    }
  }

  async function persistNoteDraft(noteId: string, draft: NoteDraftValue): Promise<boolean> {
    if (noteId.startsWith("note-draft-")) {
      return true;
    }

    const result = await window.hcb?.notes.update({
      id: noteId,
      title: draft.title,
      body: draft.body
    });

    return result?.ok ?? false;
  }

  async function deleteNote(noteId: string): Promise<void> {
    const note = notes.find((candidate) => candidate.id === noteId);

    if (!note) {
      return;
    }

    if (!note.id.startsWith("note-draft-")) {
      await window.hcb?.notes.delete({ id: note.id });
    }

    const nextNotes = notes.filter((candidate) => candidate.id !== note.id);
    const nextNote = nextNotes[0] ?? null;

    setNotes(nextNotes);
    setSelectedNoteId(nextNote?.id ?? null);

    if (nextNote) {
      openNoteInspector(nextNote);
      return;
    }

    await closeInspector();
  }

  return (
    <div className="grid h-full min-h-0">
      <Panel
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              data-action-id="note.create"
              onClick={() => void createNote()}
              size="sm"
              title={actionDescription("note.create")}
              variant="primary"
            >
              <Plus aria-hidden="true" size={14} />
              {actionLabel("note.create")}
            </Button>
            <Button onClick={createDailyNote} size="sm" variant="secondary">
              <CalendarPlus aria-hidden="true" size={14} />
              Daily note
            </Button>
            <Button onClick={createMeetingNote} size="sm" variant="ghost">
              <Pencil aria-hidden="true" size={14} />
              Meeting note
            </Button>
          </div>
        }
        title="Local notes"
        description="Select a note to open details in the Inspector"
      >
        <VirtualizedList
          ariaLabel="Local notes"
          emptyState={
            <EmptyState
              description="Create a local note to populate SQLite."
              title="No local notes"
            />
          }
          estimateRowHeight={66}
          getKey={(note) => note.id}
          items={notes}
          performanceLabel="notes.list"
          renderRow={(note) => (
            <div className="border-b border-border last:border-b-0" role="listitem">
              <button
                aria-current={note.id === selectedNoteId ? "true" : undefined}
                className={cx(
                  "flex min-h-[66px] w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-fast ease-hcb focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  note.id === selectedNoteId ? "bg-surface-0" : "bg-transparent hover:bg-surface-0"
                )}
                onClick={() => void selectNote(note.id)}
                type="button"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[var(--text-md)] font-medium text-text-primary">
                      {note.title}
                    </span>
                    <span className="shrink-0 text-[var(--text-xs)] text-text-muted">
                      {note.updatedLabel}
                    </span>
                  </div>
                  <p className="truncate text-[var(--text-sm)] text-text-muted">{note.preview}</p>
                </div>
                <Badge tone="info">Local</Badge>
              </button>
            </div>
          )}
          viewportHeight={520}
        />
      </Panel>
    </div>
  );
}
