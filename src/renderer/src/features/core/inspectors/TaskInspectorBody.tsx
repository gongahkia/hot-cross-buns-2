import { useEffect } from "react";
import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
import { ListPlus } from "lucide-react";
import { useDirtyState, useInspector } from "../../../components/Inspector";
import { Button, Input } from "../../../components/primitives";
import type { useCoreViewModelSource } from "../coreViewModelSource";
import type { CorePriority, TaskViewModel } from "../coreViewModels";

export interface TaskDraft {
  mode: "create" | "edit";
  id?: string;
  title: string;
  notes: string;
  dueDate: string;
  listId: string;
  parentId: string;
  priority: CorePriority;
}

export function taskDraftsEqual(left: TaskDraft, right: TaskDraft): boolean {
  return (
    left.mode === right.mode &&
    left.id === right.id &&
    left.title === right.title &&
    left.notes === right.notes &&
    left.dueDate === right.dueDate &&
    left.listId === right.listId &&
    left.parentId === right.parentId &&
    left.priority === right.priority
  );
}

export function TaskInspectorBody({
  canSaveTask,
  draft,
  onAddSubtask,
  onDelete,
  onSave,
  parentOptions,
  setDraft,
  source
}: {
  draft: TaskDraft;
  setDraft: Dispatch<SetStateAction<TaskDraft>>;
  source: ReturnType<typeof useCoreViewModelSource>;
  parentOptions: TaskViewModel[];
  canSaveTask: boolean;
  onSave: () => Promise<void> | void;
  onAddSubtask: () => void;
  onDelete: () => Promise<void> | void;
}): JSX.Element {
  const dirty = useDirtyState<TaskDraft>(draft);
  const { update } = useInspector();

  useEffect(() => {
    setDraft((current) => (taskDraftsEqual(current, dirty.value) ? current : dirty.value));
  }, [dirty.value, setDraft]);

  useEffect(() => {
    update({ dirty: dirty.isDirty });
  }, [dirty.isDirty, update]);

  function patchDraft(partial: Partial<TaskDraft>): void {
    dirty.patch(partial);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSaveTask) {
      event.preventDefault();
      void onSave();
      return;
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      (event.key === "Backspace" || event.key === "Delete") &&
      dirty.value.mode === "edit"
    ) {
      event.preventDefault();
      void onDelete();
    }
  }

  return (
    <div className="grid gap-3" onKeyDown={handleKeyDown}>
      <Input
        aria-label="Task title"
        onChange={(event) => patchDraft({ title: event.target.value })}
        placeholder="Task title"
        value={dirty.value.title}
      />
      <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
        <span>List</span>
        <select
          aria-label="Task list"
          className="h-8 rounded-hcbMd border border-border bg-surface-0 px-2 text-[var(--text-base)] text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          disabled={source.taskLists.length === 0}
          onChange={(event) => patchDraft({ listId: event.target.value })}
          value={dirty.value.listId}
        >
          {source.taskLists.length === 0 ? <option value="">No lists available</option> : null}
          {source.taskLists.map((taskList) => (
            <option key={taskList.id} value={taskList.id}>
              {taskList.title}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Task due date"
          onChange={(event) => patchDraft({ dueDate: event.target.value })}
          type="date"
          value={dirty.value.dueDate}
        />
        <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
          <span>Priority</span>
          <select
            aria-label="Task priority"
            className="h-8 rounded-hcbMd border border-border bg-surface-0 px-2 text-[var(--text-base)] text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onChange={(event) => patchDraft({ priority: event.target.value as CorePriority })}
            value={dirty.value.priority}
          >
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
        <span>Parent</span>
        <select
          aria-label="Parent task"
          className="h-8 rounded-hcbMd border border-border bg-surface-0 px-2 text-[var(--text-base)] text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onChange={(event) => patchDraft({ parentId: event.target.value })}
          value={dirty.value.parentId}
        >
          <option value="">No parent</option>
          {parentOptions.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </label>
      <textarea
        aria-label="Task notes"
        className="min-h-20 w-full resize-none rounded-hcbMd border border-border bg-surface-0 px-3 py-2 text-[var(--text-base)] text-text-primary placeholder:text-text-muted transition-colors duration-fast ease-hcb focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onChange={(event) => patchDraft({ notes: event.target.value })}
        placeholder="Notes"
        value={dirty.value.notes}
      />
      <div className="flex items-center gap-2">
        <Button disabled={dirty.value.mode !== "edit"} onClick={onAddSubtask} size="sm" variant="secondary">
          <ListPlus aria-hidden="true" size={14} />
          Add subtask
        </Button>
      </div>
    </div>
  );
}
