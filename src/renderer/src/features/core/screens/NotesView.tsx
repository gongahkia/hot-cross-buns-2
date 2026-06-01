import { useState } from "react";
import { CacheStatePanel } from "../coreScreenShared";
import { useCoreViewModelSource } from "../coreViewModelSource";
import { NotesBoard } from "./NotesBoard";
import { NotesSidebar } from "./NotesSidebar";
import { useAutoCollapsedSidebar } from "./useAutoCollapsedSidebar";
import { useNotesController } from "./useNotesController";

export function NotesView(): JSX.Element {
  const source = useCoreViewModelSource();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { autoCollapsed, containerRef } = useAutoCollapsedSidebar();
  const effectiveSidebarCollapsed = sidebarCollapsed || autoCollapsed;
  const {
    allNoteCount,
    createNote,
    createNoteList,
    deleteNote,
    noteViewColumns,
    noteLists,
    moveNoteToList,
    selectedNoteId,
    selectedNoteViews,
    selectNote,
    starredNoteCount,
    starredNoteIds,
    renameNoteList,
    toggleNoteStar,
    toggleNoteView
  } = useNotesController(source);

  if (
    (source.dataState === "loading" ||
      source.dataState === "offline" ||
      source.dataState === "error") &&
    !source.hasCachedData
  ) {
    return <CacheStatePanel title="Notes" />;
  }

  return (
    <div
      className={`grid h-full min-h-0 gap-3 ${effectiveSidebarCollapsed ? "grid-cols-[56px_minmax(0,1fr)]" : "grid-cols-[260px_minmax(0,1fr)]"}`}
      ref={containerRef}
    >
      <NotesSidebar
        allNoteCount={allNoteCount}
        collapsed={effectiveSidebarCollapsed}
        onCreateNote={() => void createNote()}
        onCreateNoteList={() => void createNoteList()}
        onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
        onToggleView={toggleNoteView}
        noteLists={noteLists}
        selectedNoteViews={selectedNoteViews}
        starredNoteCount={starredNoteCount}
      />
      <NotesBoard
        allNoteCount={allNoteCount}
        columns={noteViewColumns}
        onDeleteNote={(noteId) => void deleteNote(noteId)}
        onMoveNote={(noteId, listId) => void moveNoteToList(noteId, listId)}
        onOpenNote={(noteId, mode = "view") => void selectNote(noteId, mode)}
        onRenameNoteList={(listId, title) => void renameNoteList(listId, title)}
        onToggleStar={toggleNoteStar}
        selectedNoteId={selectedNoteId}
        starredNoteIds={starredNoteIds}
      />
    </div>
  );
}
