import { z } from "zod";
import { appColorThemeIds } from "../themeCatalog";
import { emptyRequestSchema, idSchema, isoDateTimeSchema } from "./core";
import { taskStatusSchema } from "./tasks";

export const settingsGetRequestSchema = emptyRequestSchema;
export const appThemeSchema = z.enum(["system", "light", "dark"]);
export const appColorThemeSchema = z.enum(appColorThemeIds);
export const uiTextSizePointsSchema = z.number().min(9).max(24);
export const uiFontNameSchema = z.string().trim().min(1).max(120).nullable();
export const syncModeSchema = z.enum(["manual", "balanced", "near-real-time"]);
export const appLanguageSchema = z.enum(["system", "en"]);
export const settingsPerformanceModeSchema = z.enum(["snappy", "rich"]);
export const navigationPlacementSchema = z.enum(["left", "right"]);
export const navigationTabSchema = z.enum(["tasks", "calendar", "notes"]);
export const calendarViewModeSchema = z.enum(["agenda", "day", "multiDay", "week", "month"]);
export const trayClickActionSchema = z.enum([
  "open-menu",
  "toggle-window",
  "quick-capture",
  "open-today"
]);
export const menuBarPanelStyleSchema = z.enum(["adaptive", "agenda", "compact"]);
export const mcpPermissionModeSchema = z.enum([
  "read-only",
  "confirm-writes",
  "allow-writes"
]);
export const perSurfaceFontKeySchema = z.enum([
  "markdownEditor",
  "sidebar",
  "calendarGrid",
  "taskList",
  "inspector",
  "menuBar"
]);
export const perSurfaceFontOverrideSchema = z
  .object({
    uiFontName: uiFontNameSchema,
    uiTextSizePoints: uiTextSizePointsSchema.nullable()
  })
  .strict();
export const perSurfaceFontOverridesSchema = z
  .record(perSurfaceFontKeySchema, perSurfaceFontOverrideSchema)
  .default({});

export const savedSearchViewSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(80),
    query: z.string().min(1).max(500),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export type SavedSearchView = z.infer<typeof savedSearchViewSchema>;

export const savedTaskViewSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(80),
    filters: z
      .object({
        statuses: z.array(taskStatusSchema).max(4).optional(),
        listIds: z.array(idSchema).max(100).optional(),
        tags: z.array(z.string().min(1).max(120)).max(64).optional(),
        due: z.enum(["overdue", "today", "next14", "none"]).optional(),
        planned: z.enum(["planned", "unplanned"]).optional()
      })
      .strict(),
    groupBy: z.enum(["none", "dueDate", "list", "tag", "status"]),
    sortBy: z.enum(["dueDate", "updatedAt", "priority", "title"]),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export type SavedTaskView = z.infer<typeof savedTaskViewSchema>;

export const settingsSnapshotSchema = z
  .object({
    theme: appThemeSchema,
    colorTheme: appColorThemeSchema,
    appLanguage: appLanguageSchema,
    uiFontName: uiFontNameSchema,
    uiTextSizePoints: uiTextSizePointsSchema,
    perSurfaceFontOverrides: perSurfaceFontOverridesSchema,
    performanceMode: settingsPerformanceModeSchema,
    appBackgroundTranslucencyEnabled: z.boolean(),
    appBackgroundOpacity: z.number().min(0.35).max(1),
    disableAnimations: z.boolean(),
    uiLayoutScale: z.number().min(0.8).max(1.5),
    navigationPlacement: navigationPlacementSchema,
    hiddenNavigationTabs: z.array(navigationTabSchema).max(2),
    hiddenCalendarViewModes: z.array(calendarViewModeSchema).max(4),
    monthScrollPastMonths: z.number().int().min(0).max(24),
    monthScrollFutureMonths: z.number().int().min(0).max(24),
    quickCreateExpandedByDefault: z.boolean(),
    restoreWindowStateEnabled: z.boolean(),
    startOnLogin: z.boolean(),
    quickCaptureShortcut: z.string().min(1).max(120).nullable(),
    selectedTaskListIds: z.array(idSchema).max(100),
    selectedCalendarIds: z.array(idSchema).max(100),
    setupCompletedAt: isoDateTimeSchema.nullable(),
    syncMode: syncModeSchema,
    eventRetentionDaysBack: z.number().int().min(0).max(3650),
    completedTaskRetentionDaysBack: z.number().int().min(0).max(3650),
    showTrayIcon: z.boolean(),
    trayClickAction: trayClickActionSchema,
    menuBarPanelStyle: menuBarPanelStyleSchema,
    showMenuBarBadge: z.boolean(),
    notificationsEnabled: z.boolean(),
    notificationLeadMinutes: z.number().int().min(0).max(28 * 24 * 60),
    mcpEnabled: z.boolean(),
    mcpPermissionMode: mcpPermissionModeSchema,
    mcpPort: z.number().int().min(0).max(65535),
    defaultTimeZone: z.string().min(1).max(120),
    todayCapacityMinutes: z.number().int().min(5).max(24 * 60),
    todayWorkingHoursStart: z.number().int().min(0).max(23),
    todayWorkingHoursEnd: z.number().int().min(1).max(24),
    diagnosticsIncludePerformance: z.boolean(),
    rawGoogleDiagnosticsEnabled: z.boolean(),
    savedSearchViews: z.array(savedSearchViewSchema).max(20),
    savedTaskViews: z.array(savedTaskViewSchema).max(20)
  })
  .strict();

export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;

export const settingsUpdateRequestSchema = z
  .object({
    theme: appThemeSchema.optional(),
    colorTheme: appColorThemeSchema.optional(),
    appLanguage: appLanguageSchema.optional(),
    uiFontName: uiFontNameSchema.optional(),
    uiTextSizePoints: uiTextSizePointsSchema.optional(),
    perSurfaceFontOverrides: perSurfaceFontOverridesSchema.optional(),
    performanceMode: settingsPerformanceModeSchema.optional(),
    appBackgroundTranslucencyEnabled: z.boolean().optional(),
    appBackgroundOpacity: z.number().min(0.35).max(1).optional(),
    disableAnimations: z.boolean().optional(),
    uiLayoutScale: z.number().min(0.8).max(1.5).optional(),
    navigationPlacement: navigationPlacementSchema.optional(),
    hiddenNavigationTabs: z.array(navigationTabSchema).max(2).optional(),
    hiddenCalendarViewModes: z.array(calendarViewModeSchema).max(4).optional(),
    monthScrollPastMonths: z.number().int().min(0).max(24).optional(),
    monthScrollFutureMonths: z.number().int().min(0).max(24).optional(),
    quickCreateExpandedByDefault: z.boolean().optional(),
    restoreWindowStateEnabled: z.boolean().optional(),
    startOnLogin: z.boolean().optional(),
    quickCaptureShortcut: z.string().min(1).max(120).nullable().optional(),
    selectedTaskListIds: z.array(idSchema).max(100).optional(),
    selectedCalendarIds: z.array(idSchema).max(100).optional(),
    setupCompletedAt: isoDateTimeSchema.nullable().optional(),
    syncMode: syncModeSchema.optional(),
    eventRetentionDaysBack: z.number().int().min(0).max(3650).optional(),
    completedTaskRetentionDaysBack: z.number().int().min(0).max(3650).optional(),
    showTrayIcon: z.boolean().optional(),
    trayClickAction: trayClickActionSchema.optional(),
    menuBarPanelStyle: menuBarPanelStyleSchema.optional(),
    showMenuBarBadge: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
    notificationLeadMinutes: z.number().int().min(0).max(28 * 24 * 60).optional(),
    mcpEnabled: z.boolean().optional(),
    mcpPermissionMode: mcpPermissionModeSchema.optional(),
    mcpPort: z.number().int().min(0).max(65535).optional(),
    defaultTimeZone: z.string().min(1).max(120).optional(),
    todayCapacityMinutes: z.number().int().min(5).max(24 * 60).optional(),
    todayWorkingHoursStart: z.number().int().min(0).max(23).optional(),
    todayWorkingHoursEnd: z.number().int().min(1).max(24).optional(),
    diagnosticsIncludePerformance: z.boolean().optional(),
    rawGoogleDiagnosticsEnabled: z.boolean().optional(),
    savedSearchViews: z.array(savedSearchViewSchema).max(20).optional(),
    savedTaskViews: z.array(savedTaskViewSchema).max(20).optional()
  })
  .strict()
  .refine((request) => Object.keys(request).length > 0, {
    message: "At least one setting must be supplied"
  });

export type SettingsUpdateRequest = z.input<typeof settingsUpdateRequestSchema>;

export const settingsRecoveryActionSchema = z.enum([
  "refresh",
  "forceFullResync",
  "clearGoogleCache",
  "resetOnboarding",
  "resetMcpToken"
]);

export const settingsRecoveryActionRequestSchema = z
  .object({
    action: settingsRecoveryActionSchema,
    confirmation: z
      .object({
        accepted: z.boolean(),
        phrase: z.string().trim().max(80).optional()
      })
      .strict()
      .optional()
  })
  .strict();

export type SettingsRecoveryActionRequest = z.input<
  typeof settingsRecoveryActionRequestSchema
>;

export const settingsRecoveryActionResponseSchema = z
  .object({
    action: settingsRecoveryActionSchema,
    accepted: z.boolean(),
    destructive: z.boolean(),
    requiresReload: z.boolean(),
    message: z.string().min(1).max(500)
  })
  .strict();

export type SettingsRecoveryActionResponse = z.infer<
  typeof settingsRecoveryActionResponseSchema
>;
