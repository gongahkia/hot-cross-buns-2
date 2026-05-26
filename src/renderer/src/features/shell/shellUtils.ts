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
    return source.taskFilterViewModels.find((filter) => filter.id === "open")?.countLabel ?? "0";
  }

  if (sectionId === "calendar") {
    return String(source.calendarAgendaEvents.length);
  }

  if (sectionId === "notes") {
    return String(source.largeTaskWindow.filter((task) => task.status === "open" && !task.dueDate && !task.plannedStart).length);
  }

  if (sectionId === "settings") {
    return source.syncStatus.state;
  }

  return source.todayViewModel.metrics[0]?.value ?? "0";
}
