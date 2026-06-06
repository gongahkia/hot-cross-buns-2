import type { CoreViewModelSource } from "../core/coreViewModelSource";
import type { SectionId } from "../../data/mockPlanner";

export function scheduleFrame(callback: () => void): void {
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(callback);
    return;
  }

  window.setTimeout(callback, 0);
}

export function shellCanBeReported(source: CoreViewModelSource): boolean {
  return (
    source.appearanceReady ||
    source.dataState === "offline" ||
    source.dataState === "error"
  );
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea"
  );
}

export function sectionMetric(source: CoreViewModelSource, sectionId: SectionId): string {
  if (sectionId === "tasks") {
    if (source.resourceCounts.tasks === null) {
      return "...";
    }

    return String(
      source.largeTaskWindow.filter((task) =>
        task.parentId === null &&
        task.dueDate !== null &&
        (task.status === "open" || task.status === "completed")
      ).length
    );
  }

  if (sectionId === "calendar") {
    return formatCount(source.resourceCounts.calendarEvents);
  }

  if (sectionId === "notes") {
    if (source.resourceCounts.notes === null) {
      return "...";
    }

    const loadedNoteCount = source.noteLists.reduce((count, list) => count + list.noteCount, 0);
    return String(source.noteLists.length > 0 ? loadedNoteCount : source.resourceCounts.notes);
  }

  if (sectionId === "settings") {
    return source.syncStatus.state;
  }

  return source.todayViewModel.metrics[0]?.value ?? "0";
}

function formatCount(count: number | null): string {
  return count === null ? "..." : String(count);
}
