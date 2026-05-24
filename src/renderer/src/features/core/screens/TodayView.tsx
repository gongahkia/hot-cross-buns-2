import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import type { ScheduleSlot } from "@shared/ipc/contracts";
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
import { Badge, Button, IconButton, Input, ListRow, Panel, StatusBanner, cx } from "../../../components/primitives";
import { EmptyState } from "../../../components/states";
import { VirtualizedList } from "../../../components/VirtualizedList";
import { useCoreViewModelSource } from "../coreViewModelSource";
import type {
  CalendarEventViewModel,
  ScheduledTaskBlockViewModel,
  TaskViewModel
} from "../coreViewModels";
import {
  CacheStatePanel,
  EventRow,
  MetricTile,
  SectionChrome,
  TaskCompletionButton,
  dateOnlyFromLocalDate,
  defaultCalendarId,
  defaultTaskListId,
  priorityLabel,
  priorityTone,
  scheduledBlockByTaskId,
  taskBridgeDescription,
  taskDueCue,
  taskDurationLabel
} from "../coreScreenShared";

function TodayTimelineRow({
  onMoveBlock,
  onRepairBlock,
  onResizeBlock,
  onUnscheduleBlock,
  row
}: {
  onMoveBlock: (block: ScheduledTaskBlockViewModel, minutes: number) => void;
  onRepairBlock: (block: ScheduledTaskBlockViewModel) => void;
  onResizeBlock: (block: ScheduledTaskBlockViewModel, minutes: number) => void;
  onUnscheduleBlock: (blockId: string) => void;
  row:
    | { kind: "task"; task: TaskViewModel }
    | { kind: "event"; event: CalendarEventViewModel }
    | { kind: "scheduledTaskBlock"; block: ScheduledTaskBlockViewModel };
}): JSX.Element {
  if (row.kind === "event") {
    return <EventRow event={row.event} />;
  }

  if (row.kind === "scheduledTaskBlock") {
    const conflictDetail =
      row.block.conflictTitles.length > 0
        ? ` - Conflicts with ${row.block.conflictTitles.join(", ")}`
        : "";

    return (
      <ListRow
        description={`${row.block.rangeLabel} - ${row.block.calendar}${conflictDetail}`}
        leading={<Clock3 aria-hidden="true" className="text-accent" size={17} />}
        meta={`${row.block.durationMinutes} min`}
        title={row.block.title}
        trailing={
          <div className="flex items-center gap-1">
            {row.block.isNextUp ? <Badge tone="info">Next</Badge> : null}
            {row.block.conflictCount > 0 ? <Badge tone="warning">Conflict</Badge> : null}
            {row.block.mutationState && row.block.mutationState !== "synced" ? (
              <Badge tone={row.block.mutationState === "failed" ? "danger" : "warning"}>
                {row.block.mutationState === "failed" ? "Failed" : "Queued"}
              </Badge>
            ) : (
              <Badge tone={row.block.status === "orphaned" ? "warning" : "accent"}>
                {row.block.status === "orphaned" ? "Needs repair" : "Scheduled"}
              </Badge>
            )}
            {row.block.status === "orphaned" ? (
              <IconButton
                icon={RotateCcw}
                label={`Repair ${row.block.title}`}
                onClick={() => onRepairBlock(row.block)}
                variant="ghost"
              />
            ) : null}
            <IconButton
              icon={StepBack}
              label={`Move ${row.block.title} earlier`}
              onClick={() => onMoveBlock(row.block, -30)}
              variant="ghost"
            />
            <IconButton
              icon={StepForward}
              label={`Move ${row.block.title} later`}
              onClick={() => onMoveBlock(row.block, 30)}
              variant="ghost"
            />
            <IconButton
              disabled={row.block.durationMinutes <= 15}
              icon={Minus}
              label={`Shorten ${row.block.title}`}
              onClick={() => onResizeBlock(row.block, -15)}
              variant="ghost"
            />
            <IconButton
              icon={Plus}
              label={`Lengthen ${row.block.title}`}
              onClick={() => onResizeBlock(row.block, 15)}
              variant="ghost"
            />
            <IconButton
              icon={X}
              label={`Unschedule ${row.block.title}`}
              onClick={() => onUnscheduleBlock(row.block.id)}
              variant="ghost"
            />
          </div>
        }
      />
    );
  }

  return (
    <ListRow
      description={row.task.detail}
      leading={<Circle aria-hidden="true" className="text-text-muted" size={17} />}
      meta={row.task.dueLabel}
      title={row.task.title}
      trailing={<Badge tone={priorityTone(row.task.priority)}>{priorityLabel(row.task.priority)}</Badge>}
    />
  );
}

function TodayFocusTaskRow({
  nextStart,
  onSchedule,
  onToggleTask,
  task
}: {
  nextStart: string | null;
  onSchedule: (task: TaskViewModel, startsAt: string) => void;
  onToggleTask: (taskId: string) => void;
  task: TaskViewModel;
}): JSX.Element {
  const dueCue = taskDueCue(task);
  const scheduleAtLabel = nextStart ? `Schedule ${task.title} at ${timeLabel(nextStart)}` : `Schedule ${task.title}`;

  return (
    <ListRow
      className="transition-colors duration-fast ease-hcb hover:bg-surface-0"
      description={taskBridgeDescription(task)}
      draggable={task.status === "open"}
      leading={<TaskCompletionButton completed={task.status === "completed"} onToggle={onToggleTask} task={task} />}
      meta={taskDurationLabel(task.durationMinutes)}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-hcb-task", task.id);
      }}
      title={task.title}
      trailing={
        <div className="flex shrink-0 items-center gap-1">
          {dueCue ? <Badge tone={dueCue.tone}>{dueCue.label}</Badge> : null}
          <Badge aria-label={`Task priority ${task.title}`} className="gap-1" tone={priorityTone(task.priority)}>
            <Flag aria-hidden="true" size={11} />
            {priorityLabel(task.priority)}
          </Badge>
          <IconButton
            className="size-7"
            disabled={!nextStart || task.status !== "open"}
            icon={CalendarClock}
            label={scheduleAtLabel}
            onClick={() => nextStart ? onSchedule(task, nextStart) : undefined}
            variant="ghost"
          />
        </div>
      }
    />
  );
}

function TodayScheduledBlockRow({
  block,
  onMoveBlock,
  onRepairBlock,
  onResizeBlock,
  onUnscheduleBlock
}: {
  block: ScheduledTaskBlockViewModel;
  onMoveBlock: (block: ScheduledTaskBlockViewModel, minutes: number) => void;
  onRepairBlock: (block: ScheduledTaskBlockViewModel) => void;
  onResizeBlock: (block: ScheduledTaskBlockViewModel, minutes: number) => void;
  onUnscheduleBlock: (blockId: string) => void;
}): JSX.Element {
  const conflictDetail =
    block.conflictTitles.length > 0 ? ` - Conflicts with ${block.conflictTitles.join(", ")}` : "";

  return (
    <ListRow
      className={block.status === "orphaned" ? "bg-warning/10" : undefined}
      description={`${block.rangeLabel} - ${block.calendar}${conflictDetail}`}
      leading={<CalendarClock aria-hidden="true" className="text-accent" size={17} />}
      meta={taskDurationLabel(block.durationMinutes)}
      selected={block.isNextUp}
      title={block.title}
      trailing={
        <div className="flex shrink-0 items-center gap-1">
          {block.isNextUp ? <Badge tone="info">Next</Badge> : null}
          {block.conflictCount > 0 ? <Badge tone="danger">Conflict</Badge> : null}
          {block.mutationState && block.mutationState !== "synced" ? (
            <Badge tone={block.mutationState === "failed" ? "danger" : "warning"}>
              {block.mutationState === "failed" ? "Failed" : "Queued"}
            </Badge>
          ) : (
            <Badge tone={block.status === "orphaned" ? "warning" : "success"}>
              {block.status === "orphaned" ? "Needs repair" : "Scheduled"}
            </Badge>
          )}
          {block.status === "orphaned" ? (
            <IconButton
              className="size-7"
              icon={RotateCcw}
              label={`Repair ${block.title}`}
              onClick={() => onRepairBlock(block)}
              variant="ghost"
            />
          ) : null}
          <IconButton
            className="size-7"
            icon={StepBack}
            label={`Move ${block.title} earlier`}
            onClick={() => onMoveBlock(block, -30)}
            variant="ghost"
          />
          <IconButton
            className="size-7"
            icon={StepForward}
            label={`Move ${block.title} later`}
            onClick={() => onMoveBlock(block, 30)}
            variant="ghost"
          />
          <IconButton
            className="size-7"
            disabled={block.durationMinutes <= 15}
            icon={Minus}
            label={`Shorten ${block.title}`}
            onClick={() => onResizeBlock(block, -15)}
            variant="ghost"
          />
          <IconButton
            className="size-7"
            icon={Plus}
            label={`Lengthen ${block.title}`}
            onClick={() => onResizeBlock(block, 15)}
            variant="ghost"
          />
          <IconButton
            className="size-7"
            icon={X}
            label={`Unschedule ${block.title}`}
            onClick={() => onUnscheduleBlock(block.id)}
            variant="ghost"
          />
        </div>
      }
    />
  );
}

type TodayTimelineDataRow =
  | { kind: "task"; task: TaskViewModel }
  | { kind: "event"; event: CalendarEventViewModel }
  | { kind: "scheduledTaskBlock"; block: ScheduledTaskBlockViewModel };

type TodayTimelineEntry =
  | { kind: "header"; id: string; title: string; detail: string; count: number }
  | { kind: "row"; id: string; row: TodayTimelineDataRow };

const todayTimelineSections = [
  {
    id: "all-day",
    title: "All day",
    detail: "Fixed calendar blocks"
  },
  {
    id: "morning",
    title: "Morning",
    detail: "Before noon"
  },
  {
    id: "afternoon",
    title: "Afternoon",
    detail: "Midday work"
  },
  {
    id: "evening",
    title: "Evening",
    detail: "Later agenda"
  },
  {
    id: "unscheduled",
    title: "Unscheduled",
    detail: "Tasks without a planned time"
  }
] as const;

type TodayTimelineSectionId = (typeof todayTimelineSections)[number]["id"];

function todayTimelineSection(row: TodayTimelineDataRow): TodayTimelineSectionId {
  if (row.kind === "task") {
    return "unscheduled";
  }

  const startsAt = row.kind === "scheduledTaskBlock" ? row.block.startsAt : row.event.startsAt;

  if (row.kind === "event" && row.event.allDay) {
    return "all-day";
  }

  const hour = new Date(startsAt).getHours();

  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  return "evening";
}

function buildTodayTimelineEntries(rows: TodayTimelineDataRow[]): TodayTimelineEntry[] {
  const grouped = new Map<TodayTimelineSectionId, TodayTimelineDataRow[]>();

  for (const row of rows) {
    const sectionId = todayTimelineSection(row);
    grouped.set(sectionId, [...(grouped.get(sectionId) ?? []), row]);
  }

  return todayTimelineSections.flatMap((section) => {
    const sectionRows = grouped.get(section.id) ?? [];

    if (sectionRows.length === 0) {
      return [];
    }

    return [
      {
        kind: "header" as const,
        id: section.id,
        title: section.title,
        detail: section.detail,
        count: sectionRows.length
      },
      ...sectionRows.map((row, index) => ({
        kind: "row" as const,
        id: `${section.id}-${row.kind}-${index}`,
        row
      }))
    ];
  });
}

function TodayTimelineHeader({
  count,
  detail,
  title
}: {
  count: number;
  detail: string;
  title: string;
}): JSX.Element {
  return (
    <div className="flex min-h-9 items-center gap-3 border-b border-border bg-bg-tertiary px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[var(--text-sm)] font-semibold text-text-primary">{title}</div>
        <div className="truncate text-[var(--text-xs)] text-text-muted">{detail}</div>
      </div>
      <Badge tone="neutral">{count}</Badge>
    </div>
  );
}

interface TodayGridRow {
  id: string;
  startsAt: string;
  label: string;
}

type QuickAddKind = "task" | "event";

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC"
  }).format(new Date(value));
}

function todayGridRows(date: string, startHour: number, endHour: number): TodayGridRow[] {
  const rows: TodayGridRow[] = [];
  const startMs = Date.parse(`${date}T00:00:00.000Z`) + startHour * 60 * 60 * 1000;
  const count = Math.max(0, (endHour - startHour) * 2);

  for (let index = 0; index < count; index += 1) {
    const startsAt = new Date(startMs + index * 30 * 60 * 1000).toISOString();
    rows.push({
      id: startsAt,
      startsAt,
      label: timeLabel(startsAt)
    });
  }

  return rows;
}

function nextOpenScheduleStart(
  rows: TodayGridRow[],
  slotsByRow: Map<string, ScheduleSlot[]>
): string | null {
  let lastBusyIndex = -1;

  rows.forEach((row, index) => {
    if ((slotsByRow.get(row.id) ?? []).length > 0) {
      lastBusyIndex = index;
    }
  });

  const afterBusy = rows.find((row, index) => index > lastBusyIndex && (slotsByRow.get(row.id) ?? []).length === 0);

  if (afterBusy) {
    return afterBusy.startsAt;
  }

  return rows.find((row) => (slotsByRow.get(row.id) ?? []).length === 0)?.startsAt ?? rows[0]?.startsAt ?? null;
}

function scheduleSlotDurationMinutes(slot: ScheduleSlot): number {
  return Math.max(5, Math.round((Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000));
}

function scheduleSlotMinutesFromStart(slot: ScheduleSlot, startHour: number): number {
  const dateStart = Date.parse(`${slot.startsAt.slice(0, 10)}T00:00:00.000Z`);
  return Math.max(0, Math.round((Date.parse(slot.startsAt) - dateStart) / 60_000) - startHour * 60);
}

function halfHourRowStart(value: string): string {
  const date = new Date(value);
  const minutes = date.getUTCMinutes();

  date.setUTCMinutes(minutes < 30 ? 0 : 30, 0, 0);
  return date.toISOString();
}

function addMinutesIso(startsAt: string, minutes: number): string {
  return new Date(Date.parse(startsAt) + minutes * 60 * 1000).toISOString();
}

function slotTitle(slot: ScheduleSlot, source: ReturnType<typeof useCoreViewModelSource>): string {
  if (slot.taskId) {
    return source.getTaskById(slot.taskId).title;
  }

  if (slot.eventId) {
    return source.calendarEventsById[slot.eventId]?.title ?? "Calendar event";
  }

  return "Scheduled";
}

function slotDetail(slot: ScheduleSlot, source: ReturnType<typeof useCoreViewModelSource>): string {
  if (slot.taskId) {
    const task = source.getTaskById(slot.taskId);
    return `${task.list} - ${scheduleSlotDurationMinutes(slot)} min`;
  }

  if (slot.eventId) {
    const event = source.calendarEventsById[slot.eventId];
    return event ? `${event.calendar} - ${event.rangeLabel}` : "Calendar event";
  }

  return `${scheduleSlotDurationMinutes(slot)} min`;
}

function slotTone(slot: ScheduleSlot): { border: string; background: string; label: string } {
  if (slot.conflict) {
    return {
      border: "border-danger",
      background: "rgba(244, 63, 94, 0.16)",
      label: "Conflict"
    };
  }

  if (slot.eventId) {
    return {
      border: "border-accent",
      background: "rgba(56, 189, 248, 0.14)",
      label: "Event"
    };
  }

  if (slot.locked) {
    return {
      border: "border-warning",
      background: "rgba(245, 158, 11, 0.14)",
      label: "Locked"
    };
  }

  return {
    border: "border-success",
    background: "rgba(34, 197, 94, 0.14)",
    label: "Task"
  };
}

export function TodayView(): JSX.Element {
  const source = useCoreViewModelSource();
  const schedule = source.todayViewModel.schedule;
  const todayDate = dateOnlyFromLocalDate(new Date());
  const startHour = source.settings.todayWorkingHoursStart;
  const endHour = Math.max(startHour + 1, source.settings.todayWorkingHoursEnd);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const [quickAddSlot, setQuickAddSlot] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddKind, setQuickAddKind] = useState<QuickAddKind>("task");
  const [todayActionError, setTodayActionError] = useState<string | null>(null);
  const rows = useMemo(() => todayGridRows(todayDate, startHour, endHour), [endHour, startHour, todayDate]);
  const slotsByRow = useMemo(() => {
    const byRow = new Map<string, ScheduleSlot[]>();

    for (const slot of schedule.slots) {
      const key = halfHourRowStart(slot.startsAt);
      byRow.set(key, [...(byRow.get(key) ?? []), slot]);
    }

    return byRow;
  }, [schedule.slots]);
  const scheduledBlocksByTaskId = useMemo(
    () => scheduledBlockByTaskId(source.scheduledTaskBlocks),
    [source.scheduledTaskBlocks]
  );
  const todayScheduledBlocks = useMemo(
    () =>
      source.scheduledTaskBlocks
        .filter((block) => block.startsAt.slice(0, 10) === todayDate || block.status === "orphaned")
        .sort(
          (left, right) =>
            left.startsAt.localeCompare(right.startsAt) ||
            left.endsAt.localeCompare(right.endsAt) ||
            left.title.localeCompare(right.title)
        ),
    [source.scheduledTaskBlocks, todayDate]
  );
  const nextScheduleStart = useMemo(
    () => nextOpenScheduleStart(rows, slotsByRow),
    [rows, slotsByRow]
  );
  const unscheduledTasks = schedule.unscheduled.map((task) => source.getTaskById(task.id));
  const usedCapacityMinutes = schedule.slots
    .filter((slot) => slot.taskId)
    .reduce((total, slot) => total + scheduleSlotDurationMinutes(slot), 0);
  const capacityPercent = Math.min(100, Math.round((usedCapacityMinutes / source.settings.todayCapacityMinutes) * 100));
  const conflictCount = schedule.slots.filter((slot) => slot.conflict).length;
  const currentRowId = halfHourRowStart(nowIso);

  useEffect(() => {
    const interval = window.setInterval(() => setNowIso(new Date().toISOString()), 60_000);

    return () => window.clearInterval(interval);
  }, []);

  if (
    (source.dataState === "loading" ||
      source.dataState === "empty" ||
      source.dataState === "offline" ||
      source.dataState === "error") &&
    !source.hasCachedData
  ) {
    return <CacheStatePanel title="Today" />;
  }

  async function saveTaskSchedule(taskId: string, startsAt: string, durationMinutes: number): Promise<void> {
    const existingSlot = schedule.slots.find((slot) => slot.taskId === taskId);

    if (existingSlot?.locked) {
      return;
    }

    setTodayActionError(null);

    const existingBlock = scheduledBlocksByTaskId.get(taskId);
    const calendarId = existingBlock?.calendarId ?? defaultCalendarId(source);
    const saved = existingBlock
      ? await source.moveScheduledTaskBlock({
          id: existingBlock.id,
          calendarId,
          startsAt,
          durationMinutes
        })
      : calendarId
        ? await source.scheduleTaskBlock({
            taskId,
            calendarId,
            startsAt,
            durationMinutes
          })
        : await source.updateTask({
            id: taskId,
            plannedStart: startsAt,
            plannedEnd: addMinutesIso(startsAt, durationMinutes),
            durationMinutes
          });

    if (saved) {
      source.refresh();
    } else {
      setTodayActionError("Task schedule was not saved.");
    }
  }

  async function moveTaskSlotBy(slot: ScheduleSlot, minutes: number): Promise<void> {
    if (!slot.taskId || slot.locked) {
      return;
    }

    await saveTaskSchedule(
      slot.taskId,
      addMinutesIso(slot.startsAt, minutes),
      scheduleSlotDurationMinutes(slot)
    );
  }

  function scheduleTaskAt(task: TaskViewModel, startsAt: string): void {
    void saveTaskSchedule(task.id, startsAt, task.durationMinutes ?? 30);
  }

  async function moveScheduledBlockBy(block: ScheduledTaskBlockViewModel, minutes: number): Promise<void> {
    const saved = await source.moveScheduledTaskBlock({
      id: block.id,
      calendarId: block.calendarId,
      startsAt: addMinutesIso(block.startsAt, minutes),
      durationMinutes: block.durationMinutes
    });

    if (saved) {
      source.refresh();
    }
  }

  async function resizeScheduledBlockBy(block: ScheduledTaskBlockViewModel, minutes: number): Promise<void> {
    const durationMinutes = Math.max(15, block.durationMinutes + minutes);
    const saved = await source.moveScheduledTaskBlock({
      id: block.id,
      calendarId: block.calendarId,
      startsAt: block.startsAt,
      durationMinutes
    });

    if (saved) {
      source.refresh();
    }
  }

  async function repairScheduledBlock(block: ScheduledTaskBlockViewModel): Promise<void> {
    const saved = await source.moveScheduledTaskBlock({
      id: block.id,
      calendarId: block.calendarId || defaultCalendarId(source),
      startsAt: block.startsAt,
      durationMinutes: block.durationMinutes
    });

    if (saved) {
      source.refresh();
    }
  }

  async function unscheduleBlock(blockId: string): Promise<void> {
    const saved = await source.unscheduleTaskBlock(blockId);

    if (saved) {
      source.refresh();
    }
  }

  async function createQuickAdd(): Promise<void> {
    const title = quickAddTitle.trim();

    if (!quickAddSlot || !title) {
      return;
    }

    setTodayActionError(null);

    if (quickAddKind === "task") {
      const created = await source.createTask({
        title,
        notes: "",
        dueDate: null,
        listId: defaultTaskListId(source),
        parentId: null,
        priority: "none",
        plannedStart: quickAddSlot,
        plannedEnd: addMinutesIso(quickAddSlot, 30),
        durationMinutes: 30
      });

      if (created) {
        setQuickAddTitle("");
        setQuickAddSlot(null);
        source.refresh();
      }

      return;
    }

    const result = await window.hcb?.calendar.create({
      title,
      calendarId: defaultCalendarId(source),
      startsAt: quickAddSlot,
      endsAt: addMinutesIso(quickAddSlot, 30),
      allDay: false,
      location: "",
      notes: "",
      guestEmails: [],
      reminderMinutes: []
    });

    if (!result?.ok) {
      setTodayActionError(result?.error.message ?? "Calendar event create failed.");
      return;
    }

    setQuickAddTitle("");
    setQuickAddSlot(null);
    source.refresh();
  }

  function dropTaskAt(row: TodayGridRow, event: DragEvent<HTMLDivElement>): void {
    const taskId = event.dataTransfer.getData("application/x-hcb-task");

    if (!taskId) {
      return;
    }

    event.preventDefault();
    const slot = schedule.slots.find((candidate) => candidate.taskId === taskId);
    const durationMinutes = slot ? scheduleSlotDurationMinutes(slot) : source.getTaskById(taskId).durationMinutes ?? 30;
    void saveTaskSchedule(taskId, row.startsAt, durationMinutes);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <MetricTile label="Used" value={`${usedCapacityMinutes}/${source.settings.todayCapacityMinutes} min`} />
        <MetricTile label="Scheduled" value={String(schedule.slots.length)} />
        <MetricTile label="Conflicts" value={String(conflictCount)} />
        <MetricTile label="Unscheduled" value={String(schedule.unscheduled.length)} />
      </div>

      <StatusBanner
        description={`${startHour}:00-${endHour}:00 - ${schedule.overloadMinutes} overload minutes`}
        icon={conflictCount > 0 || schedule.overloadMinutes > 0 ? AlertTriangle : Clock3}
        title={`Today ${source.todayViewModel.currentTimeLabel}`}
        tone={conflictCount > 0 || schedule.overloadMinutes > 0 ? "warning" : "info"}
      />

      <SectionChrome
        title="Today"
        sidebar={
          <div className="grid gap-3">
            <Panel title="Focus queue" description="Open unscheduled tasks">
              <VirtualizedList
                ariaLabel="Today focus queue"
                estimateRowHeight={68}
                getKey={(task) => task.id}
                items={unscheduledTasks}
                performanceLabel="today.focus-tasks"
                renderRow={(task) => (
                  <TodayFocusTaskRow
                    nextStart={nextScheduleStart}
                    onSchedule={scheduleTaskAt}
                    onToggleTask={(taskId) => void source.completeTask(taskId)}
                    task={task}
                  />
                )}
                viewportHeight={220}
              />
            </Panel>
            <Panel
              title="Scheduled blocks"
              description={
                todayScheduledBlocks.length === 0
                  ? "No linked blocks today"
                  : `${todayScheduledBlocks.length} linked ${todayScheduledBlocks.length === 1 ? "block" : "blocks"}`
              }
            >
              <VirtualizedList
                ariaLabel="Scheduled task blocks"
                emptyState={
                  <EmptyState
                    description="Schedule a task from the focus queue or by dropping it on the timeline."
                    title="No scheduled blocks"
                  />
                }
                estimateRowHeight={64}
                getKey={(block) => block.id}
                items={todayScheduledBlocks}
                performanceLabel="today.scheduled-blocks"
                renderRow={(block) => (
                  <TodayScheduledBlockRow
                    block={block}
                    onMoveBlock={(candidate, minutes) => void moveScheduledBlockBy(candidate, minutes)}
                    onRepairBlock={(candidate) => void repairScheduledBlock(candidate)}
                    onResizeBlock={(candidate, minutes) => void resizeScheduledBlockBy(candidate, minutes)}
                    onUnscheduleBlock={(blockId) => void unscheduleBlock(blockId)}
                  />
                )}
                viewportHeight={180}
              />
            </Panel>
          </div>
        }
      >
        <Panel
          title="Timeline"
          description="Schedule suggestion from the local cache"
          action={
            <Badge tone={schedule.overloadMinutes > 0 ? "warning" : "success"}>
              {schedule.overloadMinutes > 0 ? `${schedule.overloadMinutes} min over` : "Within capacity"}
            </Badge>
          }
        >
          <div className="grid gap-3 p-3">
            <div className="h-2 overflow-hidden rounded-hcbSm bg-bg-tertiary">
              <div
                className={cx(
                  "h-full rounded-hcbSm",
                  schedule.overloadMinutes > 0 ? "bg-warning" : "bg-success"
                )}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
            {todayActionError ? (
              <StatusBanner description={todayActionError} title="Today action failed" tone="warning" />
            ) : null}
            {quickAddSlot ? (
              <div className="grid gap-2 rounded-hcbMd border border-border bg-bg-tertiary p-3" role="dialog" aria-label="Quick add">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-sm)] font-medium text-text-primary">
                    Quick add {timeLabel(quickAddSlot)}
                  </span>
                  <IconButton icon={X} label="Close quick add" onClick={() => setQuickAddSlot(null)} variant="ghost" />
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    aria-label="Quick add title"
                    onChange={(event) => setQuickAddTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void createQuickAdd();
                      }
                    }}
                    placeholder="Title"
                    value={quickAddTitle}
                  />
                  <Button
                    aria-pressed={quickAddKind === "task"}
                    onClick={() => setQuickAddKind("task")}
                    size="sm"
                    variant={quickAddKind === "task" ? "secondary" : "ghost"}
                  >
                    Task
                  </Button>
                  <Button
                    aria-pressed={quickAddKind === "event"}
                    onClick={() => setQuickAddKind("event")}
                    size="sm"
                    variant={quickAddKind === "event" ? "secondary" : "ghost"}
                  >
                    Event
                  </Button>
                </div>
                <Button disabled={!quickAddTitle.trim()} onClick={() => void createQuickAdd()} size="sm" variant="primary">
                  <CalendarPlus aria-hidden="true" size={14} />
                  Add
                </Button>
              </div>
            ) : null}
          <VirtualizedList
            ariaLabel="Today timeline"
            estimateRowHeight={56}
            emptyState={
              <EmptyState
                description="No working-hour rows are available."
                title="No timeline rows"
              />
            }
            getKey={(row) => row.id}
            items={rows}
            performanceLabel="today.timeline"
            renderRow={(row) => {
              const rowSlots = slotsByRow.get(row.id) ?? [];
              const isCurrentRow = currentRowId === row.id && todayDate === dateOnlyFromLocalDate(new Date(nowIso));
              const currentTop = ((new Date(nowIso).getUTCMinutes() % 30) / 30) * 56;

              return (
                <div className="grid min-h-14 grid-cols-[64px_minmax(0,1fr)] border-b border-border">
                  <div className="border-r border-border px-2 py-2 font-mono text-[var(--text-xs)] text-text-muted">
                    {row.label}
                  </div>
                  <div
                    aria-label={`Quick add at ${row.label}`}
                    className="relative min-h-14 bg-bg-tertiary/40 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={() => setQuickAddSlot(row.startsAt)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropTaskAt(row, event)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setQuickAddSlot(row.startsAt);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {isCurrentRow ? (
                      <div
                        aria-hidden="true"
                        className="absolute inset-x-0 z-20 h-0.5 bg-danger"
                        style={{ top: currentTop }}
                      />
                    ) : null}
                    {rowSlots.map((slot) => {
                      const tone = slotTone(slot);
                      const slotTask = slot.taskId ? source.getTaskById(slot.taskId) : null;
                      const slotBlock = slot.taskId ? scheduledBlocksByTaskId.get(slot.taskId) : undefined;
                      const durationRows = scheduleSlotDurationMinutes(slot) / 30;
                      const top = ((scheduleSlotMinutesFromStart(slot, startHour) % 30) / 30) * 56;
                      const height = Math.max(34, durationRows * 56 - 4);
                      const draggable = Boolean(slot.taskId && !slot.locked);
                      const statusLabel = slotBlock
                        ? slotBlock.status === "orphaned" ? "Needs repair" : "Scheduled"
                        : tone.label;

                      return (
                        <button
                          className={cx(
                            "absolute left-2 right-2 z-10 overflow-hidden rounded-hcbMd border px-2 py-1 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                            tone.border
                          )}
                          draggable={draggable}
                          key={`${slot.taskId ?? slot.eventId}-${slot.startsAt}`}
                          onClick={(event) => event.stopPropagation()}
                          onDragStart={(event) => {
                            if (!slot.taskId || slot.locked) {
                              event.preventDefault();
                              return;
                            }

                            event.dataTransfer.setData("application/x-hcb-task", slot.taskId);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              void moveTaskSlotBy(slot, -15);
                            } else if (event.key === "ArrowDown") {
                              event.preventDefault();
                              void moveTaskSlotBy(slot, 15);
                            }
                          }}
                          style={{ top, height, background: tone.background }}
                          type="button"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[var(--text-sm)] font-medium text-text-primary">
                              {slotTitle(slot, source)}
                            </span>
                            <Badge
                              tone={
                                slot.conflict
                                  ? "danger"
                                  : slotBlock?.status === "orphaned"
                                    ? "warning"
                                    : slotBlock
                                      ? "info"
                                      : slot.eventId
                                        ? "accent"
                                        : slot.locked
                                          ? "warning"
                                          : "success"
                              }
                            >
                              {statusLabel}
                            </Badge>
                            {slotTask ? (
                              <Badge className="gap-1" tone={priorityTone(slotTask.priority)}>
                                <Flag aria-hidden="true" size={10} />
                                {priorityLabel(slotTask.priority)}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="block truncate text-[var(--text-xs)] text-text-muted">
                            {slotDetail(slot, source)}
                            {slotBlock ? ` - ${slotBlock.calendar}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }}
            viewportHeight={342}
          />
          </div>
        </Panel>
      </SectionChrome>
    </div>
  );
}
