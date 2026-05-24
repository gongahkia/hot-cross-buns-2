import { z } from "zod";
import { hcbErrorCodeSchema } from "../result";
import { emptyRequestSchema, idSchema, isoDateTimeSchema } from "./core";
import { mcpPermissionModeSchema, syncModeSchema } from "./settings";
import { nativeCapabilityReportSchema } from "./native";
import { syncStatusResponseSchema } from "./sync";

export const startupTimingSnapshotSchema = z
  .object({
    processStartedMs: z.number().nonnegative().optional(),
    appReadyMs: z.number().nonnegative().optional(),
    windowCreatedMs: z.number().nonnegative().optional(),
    rendererLoadedMs: z.number().nonnegative().optional(),
    shellVisibleMs: z.number().nonnegative().optional(),
    databaseReadyMs: z.number().nonnegative().optional(),
    cachedDataRenderedMs: z.number().nonnegative().optional()
  })
  .strict();

export type StartupTimingSnapshot = z.infer<typeof startupTimingSnapshotSchema>;

export const diagnosticsHealthRequestSchema = emptyRequestSchema;

const diagnosticsBuildMetadataSchema = z
  .object({
    appName: z.string().min(1).max(120),
    version: z.string().min(1).max(80),
    environment: z.enum(["development", "test", "production"]),
    electronVersion: z.string().min(1).max(80).optional(),
    nodeVersion: z.string().min(1).max(80),
    packaged: z.boolean(),
    commit: z.string().min(1).max(80).optional(),
    buildDate: isoDateTimeSchema.optional(),
    packageTool: z.string().min(1).max(80).optional()
  })
  .strict();

export const diagnosticsHealthResponseSchema = z
  .object({
    status: z.literal("ok"),
    version: z.string().min(1),
    environment: z.enum(["development", "test", "production"]),
    timestamp: isoDateTimeSchema,
    uptimeMs: z.number().nonnegative(),
    startup: startupTimingSnapshotSchema,
    build: diagnosticsBuildMetadataSchema
  })
  .strict();

export type DiagnosticsHealthResponse = z.infer<typeof diagnosticsHealthResponseSchema>;

export const diagnosticsShellVisibleRequestSchema = z
  .object({
    rendererNowMs: z.number().finite().nonnegative().optional()
  })
  .strict();

export type DiagnosticsShellVisibleRequest = z.input<
  typeof diagnosticsShellVisibleRequestSchema
>;

export const diagnosticsCachedDataRenderedRequestSchema = z
  .object({
    rendererNowMs: z.number().finite().nonnegative().optional()
  })
  .strict();

export type DiagnosticsCachedDataRenderedRequest = z.input<
  typeof diagnosticsCachedDataRenderedRequestSchema
>;

export const ipcRouteMetricSchema = z
  .object({
    route: z.string().min(1).max(160),
    totalCalls: z.number().int().nonnegative(),
    successCount: z.number().int().nonnegative(),
    failureCount: z.number().int().nonnegative(),
    validationFailures: z.number().int().nonnegative(),
    serviceFailures: z.number().int().nonnegative(),
    responseFailures: z.number().int().nonnegative(),
    averageDurationMs: z.number().nonnegative(),
    lastDurationMs: z.number().nonnegative().optional(),
    lastErrorCode: hcbErrorCodeSchema.optional(),
    lastSeenAt: isoDateTimeSchema.optional()
  })
  .strict();

export type IpcRouteMetric = z.infer<typeof ipcRouteMetricSchema>;

export const diagnosticsIpcMetricsRequestSchema = emptyRequestSchema;

export const diagnosticsIpcMetricsResponseSchema = z
  .object({
    totalCalls: z.number().int().nonnegative(),
    validationFailures: z.number().int().nonnegative(),
    serviceFailures: z.number().int().nonnegative(),
    responseFailures: z.number().int().nonnegative(),
    routes: z.array(ipcRouteMetricSchema).max(100)
  })
  .strict();

export type DiagnosticsIpcMetricsResponse = z.infer<
  typeof diagnosticsIpcMetricsResponseSchema
>;

export const localPerformanceTimingSchema = z
  .object({
    id: z.number().int().positive().optional(),
    kind: z.enum(["startup", "cached_render", "ipc", "sqlite_query", "search"]),
    name: z.string().min(1).max(160),
    durationMs: z.number().nonnegative(),
    createdAt: isoDateTimeSchema
  })
  .strict();

export type LocalPerformanceTiming = z.infer<typeof localPerformanceTimingSchema>;

export const diagnosticsPerformanceRequestSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(50)
  })
  .strict();

export type DiagnosticsPerformanceRequest = z.input<
  typeof diagnosticsPerformanceRequestSchema
>;

export const diagnosticsPerformanceResponseSchema = z
  .object({
    timings: z.array(localPerformanceTimingSchema).max(100)
  })
  .strict();

export type DiagnosticsPerformanceResponse = z.infer<
  typeof diagnosticsPerformanceResponseSchema
>;

export const diagnosticsSummaryRequestSchema = emptyRequestSchema;

const diagnosticsResourceSelectionSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1).max(500),
    selected: z.boolean()
  })
  .strict();

const diagnosticsPendingMutationBucketSchema = z
  .object({
    resourceType: z.string().min(1).max(80),
    count: z.number().int().nonnegative()
  })
  .strict();

const diagnosticsSlowQuerySampleSchema = z
  .object({
    name: z.string().min(1).max(160),
    durationMs: z.number().nonnegative(),
    createdAt: isoDateTimeSchema
  })
  .strict();

const diagnosticsMcpRequestCountsSchema = z
  .object({
    totalRequests: z.number().int().nonnegative(),
    successCount: z.number().int().nonnegative(),
    rejectedCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    rateLimitedCount: z.number().int().nonnegative()
  })
  .strict();

export const diagnosticsSummaryResponseSchema = z
  .object({
    status: z.literal("ok"),
    generatedAt: isoDateTimeSchema,
    account: z
      .object({
        state: z.enum(["signed_out", "connected", "reauth_required", "sync_paused"]),
        accountId: idSchema.optional(),
        email: z.string().email().max(254).optional(),
        displayName: z.string().max(200).nullable().optional(),
        grantedScopeCount: z.number().int().nonnegative(),
        missingScopeCount: z.number().int().nonnegative(),
        lastAuthenticatedAt: isoDateTimeSchema.optional(),
        updatedAt: isoDateTimeSchema.optional()
      })
      .strict(),
    sync: syncStatusResponseSchema.extend({ mode: syncModeSchema }).strict(),
    cache: z
      .object({
        taskListCount: z.number().int().nonnegative(),
        taskCount: z.number().int().nonnegative(),
        calendarCount: z.number().int().nonnegative(),
        eventCount: z.number().int().nonnegative(),
        noteCount: z.number().int().nonnegative(),
        performanceSampleCount: z.number().int().nonnegative(),
        migrationVersion: z.number().int().nonnegative(),
        migrationDurationMs: z.number().nonnegative()
      })
      .strict(),
    selectedResources: z
      .object({
        taskLists: z.array(diagnosticsResourceSelectionSchema).max(100),
        calendars: z.array(diagnosticsResourceSelectionSchema).max(100)
      })
      .strict(),
    checkpoints: z
      .object({
        totalCount: z.number().int().nonnegative(),
        tasksCount: z.number().int().nonnegative(),
        calendarCount: z.number().int().nonnegative(),
        lastUpdatedAt: isoDateTimeSchema.optional()
      })
      .strict(),
    pendingMutations: z
      .object({
        totalCount: z.number().int().nonnegative(),
        pendingCount: z.number().int().nonnegative(),
        applyingCount: z.number().int().nonnegative(),
        failedCount: z.number().int().nonnegative(),
        retryableCount: z.number().int().nonnegative(),
        authPausedCount: z.number().int().nonnegative(),
        nextRetryAt: isoDateTimeSchema.optional(),
        lastErrorCode: hcbErrorCodeSchema.optional(),
        byResourceType: z.array(diagnosticsPendingMutationBucketSchema).max(20)
      })
      .strict(),
    mcp: z
      .object({
        enabled: z.boolean(),
        running: z.boolean(),
        permissionMode: mcpPermissionModeSchema,
        confirmationRequired: z.boolean(),
        url: z.literal("http://127.0.0.1").optional(),
        port: z.number().int().min(0).max(65535),
        tokenState: z.enum(["not_configured", "configured", "rotated"]),
        lastTokenResetAt: isoDateTimeSchema.optional(),
        requestCounts: diagnosticsMcpRequestCountsSchema
      })
      .strict(),
    native: nativeCapabilityReportSchema,
    build: diagnosticsBuildMetadataSchema,
    performance: z
      .object({
        startup: startupTimingSnapshotSchema,
        migrationDurationMs: z.number().nonnegative(),
        lastSyncDurationMs: z.number().nonnegative().optional(),
        slowQuerySamples: z.array(diagnosticsSlowQuerySampleSchema).max(10),
        pendingMutationCounts: z
          .object({
            totalCount: z.number().int().nonnegative(),
            failedCount: z.number().int().nonnegative()
          })
          .strict(),
        mcpRequestCounts: diagnosticsMcpRequestCountsSchema
      })
      .strict(),
    redaction: z
      .object({
        credentials: z.literal("redacted"),
        googlePayloads: z.literal("omitted"),
        mcpBearerTokens: z.literal("redacted"),
        sensitiveBodies: z.literal("omitted")
      })
      .strict()
  })
  .strict();

export type DiagnosticsSummaryResponse = z.infer<typeof diagnosticsSummaryResponseSchema>;
