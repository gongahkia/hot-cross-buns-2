import { z } from "zod";
import {
  calendarListResponseSchema,
  calendarRangeRequestSchema,
  calendarRangeResponseSchema,
  scheduledTaskBlockListResponseSchema
} from "./calendar";
import { googleStatusResponseSchema } from "./google";
import { nativeCapabilitiesResponseSchema } from "./native";
import { noteListResponseSchema } from "./notes";
import { settingsSnapshotSchema } from "./settings";
import { syncStatusResponseSchema } from "./sync";
import {
  taskListResponseSchema,
  taskListsResponseSchema
} from "./tasks";
import { undoStackStatusResponseSchema } from "./undo";

export const bootstrapGetRequestSchema = z
  .object({
    calendarRange: calendarRangeRequestSchema
  })
  .strict();

export type BootstrapGetRequest = z.input<typeof bootstrapGetRequestSchema>;

export const bootstrapResourceCountsSchema = z
  .object({
    calendarEvents: z.number().int().nonnegative(),
    notes: z.number().int().nonnegative(),
    tasks: z.number().int().nonnegative()
  })
  .strict();

export const bootstrapGetResponseSchema = z
  .object({
    taskLists: taskListsResponseSchema,
    tasks: taskListResponseSchema,
    hiddenTasks: taskListResponseSchema,
    deletedTasks: taskListResponseSchema,
    calendars: calendarListResponseSchema,
    events: calendarRangeResponseSchema,
    scheduledTaskBlocks: scheduledTaskBlockListResponseSchema,
    notes: noteListResponseSchema,
    settings: settingsSnapshotSchema,
    syncStatus: syncStatusResponseSchema,
    googleStatus: googleStatusResponseSchema,
    undoStatus: undoStackStatusResponseSchema,
    native: nativeCapabilitiesResponseSchema,
    resourceCounts: bootstrapResourceCountsSchema
  })
  .strict();

export type BootstrapGetResponse = z.infer<typeof bootstrapGetResponseSchema>;
