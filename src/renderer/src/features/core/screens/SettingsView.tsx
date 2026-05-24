import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  DiagnosticsSummaryResponse,
  NativeCapabilityDescriptor,
  NativeCapabilityDiagnostic,
  SettingsRecoveryActionRequest,
  SettingsSnapshot,
  SettingsUpdateRequest
} from "@shared/ipc/contracts";
import {
  appColorThemes,
  defaultAppColorTheme,
  resolveAppColorTheme,
  resolveAppThemeMode,
  type AppColorThemeId
} from "@shared/ipc/themeCatalog";
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
import type { PlannerActionId } from "../../../actions/plannerActions";
import { useInspector } from "../../../components/Inspector";
import { Badge, Button, IconButton, Input, ListRow, Panel, StatusBanner, cx } from "../../../components/primitives";
import { EmptyState } from "../../../components/states";
import { useCoreViewModelSource } from "../coreViewModelSource";
import type { SettingsSectionId } from "../coreViewModels";
import {
  MetricTile,
  currentSystemPrefersDark,
  fontFamilyOptions,
  sanitizedJson,
  settingTone
} from "../coreScreenShared";

export function SettingsView(): JSX.Element {
  const source = useCoreViewModelSource();
  const { open: openInspector } = useInspector();
  const [selectedSectionId, setSelectedSectionId] = useState<SettingsSectionId>("google");
  const [confirmation, setConfirmation] = useState<{
    action: SettingsRecoveryActionRequest["action"];
    phrase: string;
  } | null>(null);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [selectedSettingsTab, setSelectedSettingsTab] = useState<"general" | "profile" | "appearance">("general");
  const [customRetentionAmount, setCustomRetentionAmount] = useState("60");
  const [customRetentionUnit, setCustomRetentionUnit] = useState<"days" | "months" | "years">("days");
  const selectedSection =
    source.settingsSections.find((section) => section.id === selectedSectionId) ??
    source.settingsSections[0];
  const diagnostics = source.diagnosticsSummary;
  const settings = source.settings;
  const googleStatus = source.googleStatus;
  const effectiveThemeMode = resolveAppThemeMode(settings.theme, currentSystemPrefersDark());
  const matchingColorThemes = appColorThemes.filter(
    (theme) => theme.isDark === (effectiveThemeMode === "dark")
  );
  const activeColorTheme = resolveAppColorTheme(settings.colorTheme, effectiveThemeMode);
  const defaultTimeZoneOptions = timeZoneOptions([
    settings.defaultTimeZone,
    googleStatus.account?.timeZone,
    ...source.calendarSources.map((calendar) => calendar.timeZone),
    ...source.calendarAgendaEvents.map((event) => event.timeZone)
  ]);
  const [googleClientId, setGoogleClientId] = useState(googleStatus.clientId ?? "");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [systemFontFamilies, setSystemFontFamilies] = useState<string[]>([]);
  const systemFontFamiliesRequested = useRef(false);
  const availableFontFamilies = useMemo(
    () => fontFamilyOptions(systemFontFamilies, settings.uiFontName),
    [settings.uiFontName, systemFontFamilies]
  );

  useEffect(() => {
    setGoogleClientId(googleStatus.clientId ?? "");
  }, [googleStatus.clientId]);

  useEffect(() => {
    if (
      selectedSettingsTab !== "appearance" &&
      selectedSectionId !== "appearance" ||
      systemFontFamiliesRequested.current ||
      !window.hcb
    ) {
      return;
    }

    systemFontFamiliesRequested.current = true;
    void window.hcb.native.listFontFamilies().then((result) => {
      if (result.ok) {
        setSystemFontFamilies(result.data.families);
      }
    });
  }, [selectedSectionId, selectedSettingsTab]);

  function updateSettings(request: SettingsUpdateRequest): void {
    setRecoveryMessage(null);
    void source.updateSettings(request);
  }

  function updateBaseTheme(theme: SettingsSnapshot["theme"]): void {
    const nextMode = resolveAppThemeMode(theme, currentSystemPrefersDark());
    const currentColorTheme = resolveAppColorTheme(settings.colorTheme, effectiveThemeMode);
    const nextColorTheme = currentColorTheme.isDark === (nextMode === "dark")
      ? currentColorTheme
      : defaultAppColorTheme(nextMode);

    updateSettings({
      theme,
      colorTheme: nextColorTheme.id
    });
  }

  function updateSelectedTaskList(taskListId: string, selected: boolean): void {
    const current = new Set(settings.selectedTaskListIds.length > 0
      ? settings.selectedTaskListIds
      : source.taskLists.map((taskList) => taskList.id));

    if (selected) {
      current.add(taskListId);
    } else {
      current.delete(taskListId);
    }

    updateSettings({ selectedTaskListIds: [...current] });
  }

  function updateSelectedCalendar(calendarId: string, selected: boolean): void {
    const current = new Set(settings.selectedCalendarIds.length > 0
      ? settings.selectedCalendarIds
      : source.calendarSources.filter((calendar) => calendar.selected).map((calendar) => calendar.id));

    if (selected) {
      current.add(calendarId);
    } else {
      current.delete(calendarId);
    }

    updateSettings({ selectedCalendarIds: [...current] });
  }

  function beginRecoveryAction(action: SettingsRecoveryActionRequest["action"]): void {
    if (action === "refresh" || action === "resetOnboarding") {
      void runRecovery({ action });
      return;
    }

    setConfirmation({ action, phrase: recoveryPhrase(action) });
    setConfirmationInput("");
  }

  async function runRecovery(request: SettingsRecoveryActionRequest): Promise<void> {
    const result = await source.runRecoveryAction(request);

    if (result) {
      setRecoveryMessage(result.message);
      setConfirmation(null);
      setConfirmationInput("");
    }
  }

  function confirmRecoveryAction(): void {
    if (!confirmation || confirmationInput !== confirmation.phrase) {
      return;
    }

    void runRecovery({
      action: confirmation.action,
      confirmation: {
        accepted: true,
        phrase: confirmationInput
      }
    });
  }

  function copyDiagnosticsPayload(payload: string): void {
    void navigator.clipboard?.writeText(payload);
    setRecoveryMessage("Diagnostics summary copied without credentials, raw Google payloads, MCP bearer tokens, or sensitive bodies.");
  }

  async function openDiagnosticsDetails(): Promise<void> {
    const summaryResult = diagnostics ? null : await window.hcb?.diagnostics.summary();
    const freshDiagnostics = diagnostics ?? (summaryResult?.ok ? summaryResult.data : null);
    const payload = sanitizedJson(freshDiagnostics ?? { rows: selectedSection.rows });

    openInspector({
      actions: (
        <Button onClick={() => copyDiagnosticsPayload(payload)} size="sm" variant="primary">
          <Copy aria-hidden="true" size={14} />
          Copy
        </Button>
      ),
      body: (
        <pre
          aria-label="Sanitized diagnostics JSON"
          className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-hcbMd border border-border bg-surface-0 p-3 font-mono text-[var(--text-xs)] text-text-primary"
        >
          {payload}
        </pre>
      ),
      id: "diagnostics-summary",
      kind: "diagnostics",
      subtitle: "Sanitized JSON",
      title: "Diagnostics details"
    });
  }

  function openCapabilityDetails(
    capability: NativeCapabilityDescriptor,
    report: DiagnosticsSummaryResponse["native"]
  ): void {
    const relatedDiagnostics = report.diagnostics.filter((diagnostic) => diagnostic.key === capability.key);
    const primaryDiagnostic = relatedDiagnostics[0] ?? null;
    const payload = sanitizedJson({
      capability,
      diagnostics: relatedDiagnostics,
      metadata: {
        platform: report.platform,
        adapterId: report.adapterId,
        packageFormat: report.packageFormat,
        flags: report.flags
      }
    });

    openInspector({
      body: (
        <div className="grid gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MetricTile label="State" value={capability.state} />
            <MetricTile label="Severity" value={primaryDiagnostic?.severity ?? (capability.supported ? "info" : "warning")} />
          </div>
          <StatusBanner
            description={primaryDiagnostic?.message ?? capability.message ?? "No remediation required."}
            title="Remediation"
            tone={primaryDiagnostic?.severity === "blocker" ? "danger" : capability.supported ? "info" : "warning"}
          />
          <pre
            aria-label="Capability metadata"
            className="max-h-80 overflow-auto whitespace-pre-wrap rounded-hcbMd border border-border bg-surface-0 p-3 font-mono text-[var(--text-xs)] text-text-primary"
          >
            {payload}
          </pre>
        </div>
      ),
      id: `capability-${capability.key}`,
      kind: "settings",
      subtitle: capability.state,
      title: capability.label
    });
  }

  function openNativeDiagnosticDetails(
    diagnostic: NativeCapabilityDiagnostic,
    report: DiagnosticsSummaryResponse["native"]
  ): void {
    const payload = sanitizedJson({
      diagnostic,
      metadata: {
        platform: report.platform,
        adapterId: report.adapterId,
        packageFormat: report.packageFormat
      }
    });

    openInspector({
      body: (
        <div className="grid gap-3">
          <MetricTile label="Severity" value={diagnostic.severity} />
          <StatusBanner description={diagnostic.message} title="Diagnostic" tone={diagnostic.severity === "blocker" ? "danger" : "warning"} />
          <pre
            aria-label="Native diagnostic metadata"
            className="max-h-80 overflow-auto whitespace-pre-wrap rounded-hcbMd border border-border bg-surface-0 p-3 font-mono text-[var(--text-xs)] text-text-primary"
          >
            {payload}
          </pre>
        </div>
      ),
      id: `diagnostic-${diagnostic.key}`,
      kind: "diagnostics",
      subtitle: diagnostic.severity,
      title: diagnostic.key
    });
  }

  function requestNotificationPermission(): void {
    void window.hcb?.native.requestNotificationPermission().then(() => {
      source.refresh();
    });
  }

  async function saveGoogleOAuthClient(): Promise<void> {
    setRecoveryMessage(null);

    if (!window.hcb) {
      return;
    }

    const request =
      googleClientSecret.trim().length > 0
        ? { clientId: googleClientId, clientSecret: googleClientSecret.trim() }
        : { clientId: googleClientId };
    const result = await window.hcb.google.saveOAuthClient(request);

    if (result.ok) {
      setGoogleClientSecret("");
      setRecoveryMessage("Google OAuth client configuration saved.");
      source.setGoogleStatus(result.data);
      return;
    }

    setRecoveryMessage(result.error.message);
  }

  async function beginGoogleOAuth(): Promise<void> {
    setRecoveryMessage(null);

    const result = await window.hcb?.google.beginOAuth();

    if (result?.ok) {
      setRecoveryMessage(result.data.message);
      source.refreshGoogleStatus();
      for (const delayMs of [2_000, 5_000, 10_000]) {
        window.setTimeout(() => source.refreshGoogleStatus(), delayMs);
      }
      return;
    }

    if (result && !result.ok) {
      setRecoveryMessage(result.error.message);
    }
  }

  async function disconnectGoogle(): Promise<void> {
    setRecoveryMessage(null);

    const result = await window.hcb?.google.disconnect();

    if (result?.ok) {
      setRecoveryMessage("Google account disconnected.");
      source.setGoogleStatus(result.data);
      return;
    }

    if (result && !result.ok) {
      setRecoveryMessage(result.error.message);
    }
  }

  function renderSectionControls(): JSX.Element {
    if (selectedSection.id === "google") {
      return (
        <div className="grid gap-3 p-3">
          <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
            <span>Desktop OAuth client ID</span>
            <Input
              aria-label="Google OAuth client ID"
              onChange={(event) => setGoogleClientId(event.currentTarget.value)}
              placeholder="Client ID from Google Cloud Console"
              value={googleClientId}
            />
          </label>
          <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
            <span>Client secret</span>
            <Input
              aria-label="Google OAuth client secret"
              onChange={(event) => setGoogleClientSecret(event.currentTarget.value)}
              placeholder={googleStatus.hasClientSecret ? "Stored in Keychain" : "Optional for Desktop clients"}
              type="password"
              value={googleClientSecret}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={googleClientId.trim().length < 10 || source.settingsMutationPending}
              onClick={() => void saveGoogleOAuthClient()}
            >
              <Save aria-hidden="true" size={14} />
              Save client
            </Button>
            <Button
              disabled={!googleStatus.oauthClientConfigured}
              onClick={() => void beginGoogleOAuth()}
              variant="secondary"
            >
              <CheckCircle2 aria-hidden="true" size={14} />
              Connect Google
            </Button>
            <Button
              disabled={!googleStatus.account}
              onClick={() => void disconnectGoogle()}
              variant="ghost"
            >
              Disconnect
            </Button>
          </div>
          <SettingsRows rows={selectedSection.rows} status={selectedSection.status} />
        </div>
      );
    }

    if (selectedSection.id === "resources") {
      const selectedTaskLists = new Set(settings.selectedTaskListIds);
      const selectedCalendars = new Set(settings.selectedCalendarIds);

      return (
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary sm:col-span-2">
            <span>Default timezone</span>
            <select
              aria-label="Default timezone"
              className={settingsSelectClass}
              onChange={(event) => updateSettings({ defaultTimeZone: event.target.value })}
              value={settings.defaultTimeZone}
            >
              {defaultTimeZoneOptions.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {timeZone}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
            <span>Today capacity</span>
            <Input
              aria-label="Today capacity minutes"
              max={1440}
              min={5}
              onChange={(event) =>
                updateSettings({ todayCapacityMinutes: Number(event.target.value) })
              }
              type="number"
              value={settings.todayCapacityMinutes}
            />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
              <span>Start hour</span>
              <Input
                aria-label="Today working hours start"
                max={23}
                min={0}
                onChange={(event) =>
                  updateSettings({ todayWorkingHoursStart: Number(event.target.value) })
                }
                type="number"
                value={settings.todayWorkingHoursStart}
              />
            </label>
            <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
              <span>End hour</span>
              <Input
                aria-label="Today working hours end"
                max={24}
                min={1}
                onChange={(event) =>
                  updateSettings({ todayWorkingHoursEnd: Number(event.target.value) })
                }
                type="number"
                value={settings.todayWorkingHoursEnd}
              />
            </label>
          </div>
          <div className="min-w-0 rounded-hcbMd border border-border bg-bg-tertiary">
            <div className="border-b border-border px-3 py-2">
              <h3 className="truncate text-[var(--text-md)] font-semibold text-text-primary">Task lists</h3>
              <p className="truncate text-[var(--text-xs)] text-text-muted">Google Tasks</p>
            </div>
            <div className="grid gap-2 p-3">
              {source.taskLists.length === 0 ? (
                <EmptyState description="No task lists are cached yet." title="No task lists" />
              ) : source.taskLists.map((taskList) => (
                <label
                  className="flex min-h-8 items-center gap-2 rounded-hcbMd border border-border bg-bg-tertiary px-3 text-[var(--text-sm)] text-text-secondary"
                  key={taskList.id}
                >
                  <input
                    checked={selectedTaskLists.size === 0 || selectedTaskLists.has(taskList.id)}
                    className="accent-[var(--color-accent)]"
                    onChange={(event) => updateSelectedTaskList(taskList.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span className="min-w-0 flex-1 truncate">{taskList.title}</span>
                  <Badge>{taskList.activeTaskCount ?? taskList.taskCount ?? 0}</Badge>
                </label>
              ))}
            </div>
          </div>
          <div className="min-w-0 rounded-hcbMd border border-border bg-bg-tertiary">
            <div className="border-b border-border px-3 py-2">
              <h3 className="truncate text-[var(--text-md)] font-semibold text-text-primary">Calendars</h3>
              <p className="truncate text-[var(--text-xs)] text-text-muted">Google Calendar</p>
            </div>
            <div className="grid gap-2 p-3">
              {source.calendarSources.length === 0 ? (
                <EmptyState description="No calendars are cached yet." title="No calendars" />
              ) : source.calendarSources.map((calendar) => (
                <label
                  className="flex min-h-8 items-center gap-2 rounded-hcbMd border border-border bg-bg-tertiary px-3 text-[var(--text-sm)] text-text-secondary"
                  key={calendar.id}
                >
                  <input
                    checked={selectedCalendars.size === 0 ? calendar.selected : selectedCalendars.has(calendar.id)}
                    className="accent-[var(--color-accent)]"
                    onChange={(event) => updateSelectedCalendar(calendar.id, event.target.checked)}
                    type="checkbox"
                  />
                  <span className="min-w-0 flex-1 truncate">{calendar.title}</span>
                  <Badge>{calendar.eventCount ?? 0}</Badge>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (selectedSection.id === "sync") {
      const queue = diagnostics?.pendingMutations;

      return (
        <div className="grid gap-3 p-3">
          <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
            <span>Sync mode</span>
            <select
              aria-label="Sync mode"
              className={settingsSelectClass}
              onChange={(event) =>
                updateSettings({ syncMode: event.target.value as SettingsSnapshot["syncMode"] })
              }
              value={settings.syncMode}
            >
              <option value="manual">Manual</option>
              <option value="balanced">Balanced</option>
              <option value="near-real-time">Near real-time</option>
            </select>
          </label>
          <div className="flex items-center gap-2">
            <Button
              data-action-id="sync.refresh"
              disabled={source.settingsMutationPending}
              onClick={() => beginRecoveryAction("refresh")}
            >
              <RotateCcw aria-hidden="true" size={14} />
              Refresh
            </Button>
            <Button
              data-action-id="sync.forceFullResync"
              disabled={source.settingsMutationPending}
              onClick={() => beginRecoveryAction("forceFullResync")}
              variant="danger"
            >
              Force full resync
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <MetricTile label="Pending" value={String(queue?.pendingCount ?? source.syncStatus.pendingMutationCount)} />
            <MetricTile label="Applying" value={String(queue?.applyingCount ?? 0)} />
            <MetricTile label="Failed" value={String(queue?.failedCount ?? 0)} />
            <MetricTile label="Retryable" value={String(queue?.retryableCount ?? 0)} />
            <MetricTile label="Auth paused" value={String(queue?.authPausedCount ?? 0)} />
          </div>
          {queue?.nextRetryAt ? (
            <StatusBanner
              description={queue.nextRetryAt}
              title="Next retry scheduled"
              tone="info"
            />
          ) : null}
          {queue?.byResourceType.length ? (
            <div className="grid gap-2" role="list" aria-label="Sync queue resource types">
              {queue.byResourceType.map((bucket) => (
                <ListRow
                  key={bucket.resourceType}
                  title={bucket.resourceType}
                  description={`${bucket.count} queued mutation${bucket.count === 1 ? "" : "s"}`}
                  trailing={<Badge tone="warning">{bucket.count}</Badge>}
                />
              ))}
            </div>
          ) : null}
          <SettingsRows rows={selectedSection.rows} status={selectedSection.status} />
        </div>
      );
    }

    if (selectedSection.id === "appearance") {
      return (
        <div className="grid gap-3 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
              <span>Theme</span>
              <select
                aria-label="Theme"
                className={settingsSelectClass}
                onChange={(event) => updateBaseTheme(event.target.value as SettingsSnapshot["theme"])}
                value={settings.theme}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
              <span>Color theme</span>
              <select
                aria-label="Color theme"
                className={settingsSelectClass}
                onChange={(event) => updateSettings({ colorTheme: event.target.value as AppColorThemeId })}
                value={activeColorTheme.id}
              >
                {matchingColorThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
              <span>Font family</span>
              <select
                aria-label="Font family"
                className={settingsSelectClass}
                onChange={(event) =>
                  updateSettings({
                    uiFontName: event.target.value.trim() ? event.target.value : null
                  })
                }
                value={settings.uiFontName ?? ""}
              >
                <option value="">System</option>
                {availableFontFamilies.map((fontName) => (
                  <option key={fontName} value={fontName}>
                    {fontName}
                  </option>
                ))}
              </select>
            </label>
            <Button
              onClick={() => {
                updateSettings({ uiFontName: null });
              }}
              size="sm"
              variant="ghost"
            >
              Reset font
            </Button>
          </div>
          <div className="grid gap-2 rounded-hcbMd border border-border bg-bg-tertiary p-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-[var(--text-sm)] font-medium text-text-primary" htmlFor="ui-text-size">
                Text size
              </label>
              <span className="font-mono text-[var(--text-xs)] text-text-muted">
                {settings.uiTextSizePoints} pt
              </span>
            </div>
            <input
              aria-label="Text size"
              className="w-full accent-[var(--color-accent)]"
              id="ui-text-size"
              max={24}
              min={9}
              onChange={(event) => updateSettings({ uiTextSizePoints: Number(event.target.value) })}
              step={1}
              type="range"
              value={settings.uiTextSizePoints}
            />
            <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[96px_auto]">
              <Input
                aria-label="Text size points"
                max={24}
                min={9}
                onBlur={(event) =>
                  updateSettings({
                    uiTextSizePoints: Math.min(24, Math.max(9, Number(event.currentTarget.value) || 13))
                  })
                }
                onChange={(event) =>
                  updateSettings({
                    uiTextSizePoints: Math.min(24, Math.max(9, Number(event.target.value) || 13))
                  })
                }
                step={1}
                type="number"
                value={settings.uiTextSizePoints}
              />
              <Button onClick={() => updateSettings({ uiTextSizePoints: 13 })} size="sm" variant="ghost">
                Reset size
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (selectedSection.id === "hotkeys") {
      return (
        <div className="grid gap-3 p-3">
          <StatusBanner
            description="Shortcut conflicts are recoverable and do not stop the app."
            title="Shortcut attention"
            tone="warning"
          />
          <Input
            aria-label="Quick capture shortcut"
            onBlur={(event) =>
              updateSettings({
                quickCaptureShortcut: event.currentTarget.value.trim() || null
              })
            }
            defaultValue={settings.quickCaptureShortcut ?? ""}
            placeholder="Ctrl+Space"
          />
        </div>
      );
    }

    if (selectedSection.id === "tray") {
      return (
        <div className="grid gap-3 p-3">
          <SettingsToggle
            checked={settings.showTrayIcon}
            label="Show menu bar icon"
            onChange={(checked) => updateSettings({ showTrayIcon: checked })}
          />
          <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
            <span>Primary click</span>
            <select
              aria-label="Tray click action"
              className={settingsSelectClass}
              onChange={(event) =>
                updateSettings({
                  trayClickAction: event.target.value as SettingsSnapshot["trayClickAction"]
                })
              }
              value={settings.trayClickAction}
            >
              <option value="open-menu">Open menu bar panel</option>
              <option value="toggle-window">Show or hide window</option>
              <option value="quick-capture">Quick capture</option>
              <option value="open-today">Open Today</option>
            </select>
          </label>
          <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
            <span>Panel style</span>
            <select
              aria-label="Menu bar panel style"
              className={settingsSelectClass}
              onChange={(event) =>
                updateSettings({
                  menuBarPanelStyle: event.target.value as SettingsSnapshot["menuBarPanelStyle"]
                })
              }
              value={settings.menuBarPanelStyle}
            >
              <option value="adaptive">Adaptive</option>
              <option value="agenda">Calendar</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <SettingsToggle
            checked={settings.showMenuBarBadge}
            label="Show overdue badge"
            onChange={(checked) => updateSettings({ showMenuBarBadge: checked })}
          />
        </div>
      );
    }

    if (selectedSection.id === "notifications") {
      return (
        <div className="grid gap-3 p-3">
          <SettingsToggle
            checked={settings.notificationsEnabled}
            label="Enable local notifications"
            onChange={(checked) => updateSettings({ notificationsEnabled: checked })}
          />
          <Input
            aria-label="Notification lead minutes"
            min={0}
            max={40320}
            onBlur={(event) =>
              updateSettings({
                notificationLeadMinutes: Number(event.currentTarget.value) || 0
              })
            }
            defaultValue={String(settings.notificationLeadMinutes)}
            type="number"
          />
          <Button onClick={requestNotificationPermission} variant="ghost">
            Request permission
          </Button>
        </div>
      );
    }

    if (selectedSection.id === "localData") {
      return (
        <div className="grid gap-3 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <MetricTile label="Cache rows" value={String((diagnostics?.cache.taskCount ?? 0) + (diagnostics?.cache.eventCount ?? 0))} />
            <MetricTile label="Checkpoints" value={String(diagnostics?.checkpoints.totalCount ?? 0)} />
            <MetricTile label="Pending" value={String(diagnostics?.pendingMutations.totalCount ?? 0)} />
          </div>
          <Button
            disabled={source.settingsMutationPending}
            onClick={() => beginRecoveryAction("clearGoogleCache")}
            variant="danger"
          >
            <Trash2 aria-hidden="true" size={14} />
            Clear local Google cache
          </Button>
          <Button
            disabled={source.settingsMutationPending}
            onClick={() => beginRecoveryAction("resetOnboarding")}
            variant="secondary"
          >
            <RotateCcw aria-hidden="true" size={14} />
            Reset onboarding
          </Button>
          <StatusBanner
            description="Tasks and calendar mirrors are cached in local SQLite; OAuth secrets, Google tokens, and MCP bearer tokens stay in OS credential storage. Copy diagnostics omits raw payloads, credentials, note bodies, task notes, event descriptions, and guest lists."
            title="Privacy boundary"
            tone="info"
          />
        </div>
      );
    }

    if (selectedSection.id === "mcp") {
      return (
        <div className="grid gap-3 p-3">
          <SettingsToggle
            actionId="mcp.toggle"
            checked={settings.mcpEnabled}
            label="Enable MCP server"
            onChange={(checked) => updateSettings({ mcpEnabled: checked })}
          />
          <label className="grid gap-1 text-[var(--text-sm)] text-text-secondary">
            <span>Permission mode</span>
            <select
              aria-label="MCP permission mode"
              className={settingsSelectClass}
              onChange={(event) =>
                updateSettings({
                  mcpPermissionMode: event.target.value as SettingsSnapshot["mcpPermissionMode"]
                })
              }
              value={settings.mcpPermissionMode}
            >
              <option value="read-only">Read-only</option>
              <option value="confirm-writes">Confirm writes</option>
              <option value="allow-writes">Allow writes</option>
            </select>
          </label>
          <Input
            aria-label="MCP port"
            min={0}
            max={65535}
            onBlur={(event) => updateSettings({ mcpPort: Number(event.currentTarget.value) || 0 })}
            defaultValue={String(settings.mcpPort)}
            type="number"
          />
          <Button
            disabled={source.settingsMutationPending}
            onClick={() => beginRecoveryAction("resetMcpToken")}
            variant="danger"
          >
            Reset MCP token
          </Button>
        </div>
      );
    }

    if (selectedSection.id === "platform") {
      const nativeReport = diagnostics?.native ?? source.native.capabilityReport;

      return (
        <div className="grid gap-3 p-3">
          <SettingsRows rows={selectedSection.rows} status={selectedSection.status} />
          {nativeReport?.capabilities.length ? (
            <div className="grid gap-2" role="list" aria-label="Native capabilities">
              {nativeReport.capabilities.map((capability) => (
                <button
                  aria-label={`Open capability ${capability.label}`}
                  className="flex min-h-11 w-full items-center gap-3 rounded-hcbMd border border-border bg-bg-tertiary px-3 py-2 text-left transition-colors duration-fast ease-hcb hover:bg-surface-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  key={capability.key}
                  onClick={() => openCapabilityDetails(capability, nativeReport)}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[var(--text-md)] font-medium text-text-primary">
                      {capability.label}
                    </span>
                    <span className="block truncate text-[var(--text-sm)] text-text-muted">
                      {capability.message ?? (capability.supported ? "Available" : "Unavailable")}
                    </span>
                  </span>
                  <span className="shrink-0">
                    <Badge tone={capability.supported ? "success" : "warning"}>
                      {capability.state}
                    </Badge>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              description="The sanitized native capability report has no per-feature rows yet."
              title="No capability rows"
            />
          )}
          {nativeReport?.diagnostics.length ? (
            <div className="grid gap-2" role="list" aria-label="Native diagnostics">
              {nativeReport.diagnostics.map((diagnostic) => (
                <button
                  aria-label={`Open native diagnostic ${diagnostic.key}`}
                  className="flex min-h-11 w-full items-center gap-3 rounded-hcbMd border border-border bg-bg-tertiary px-3 py-2 text-left transition-colors duration-fast ease-hcb hover:bg-surface-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  key={`${diagnostic.key}-${diagnostic.message}`}
                  onClick={() => openNativeDiagnosticDetails(diagnostic, nativeReport)}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[var(--text-md)] font-medium text-text-primary">
                      {diagnostic.key}
                    </span>
                    <span className="block truncate text-[var(--text-sm)] text-text-muted">
                      {diagnostic.message}
                    </span>
                  </span>
                  <Badge tone={diagnostic.severity === "blocker" ? "danger" : "warning"}>{diagnostic.severity}</Badge>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="grid gap-3 p-3">
        <SettingsToggle
          checked={settings.diagnosticsIncludePerformance}
          label="Include performance diagnostics"
          onChange={(checked) => updateSettings({ diagnosticsIncludePerformance: checked })}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MetricTile label="Startup" value={`${Math.round(diagnostics?.performance.startup.shellVisibleMs ?? 0)}ms`} />
          <MetricTile label="Migration" value={`${Math.round(diagnostics?.performance.migrationDurationMs ?? 0)}ms`} />
          <MetricTile label="MCP requests" value={String(diagnostics?.performance.mcpRequestCounts.totalRequests ?? 0)} />
        </div>
        <SettingsRows rows={selectedSection.rows} status={selectedSection.status} />
      </div>
    );
  }

  const navigationTabs: Array<{ id: "tasks" | "calendar" | "notes"; label: string }> = [
    { id: "tasks", label: "Tasks" },
    { id: "calendar", label: "Calendar" },
    { id: "notes", label: "Notes" }
  ];
  const calendarViewModes: Array<{ id: "agenda" | "day" | "multiDay" | "week" | "month"; label: string }> = [
    { id: "agenda", label: "Agenda" },
    { id: "day", label: "Day" },
    { id: "multiDay", label: "Multi-day" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" }
  ];
  const retentionOptions: Array<{ label: string; value: number }> = [
    { label: "Forever", value: 0 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
    { label: "180 days", value: 180 },
    { label: "1 year", value: 365 },
    { label: "2 years", value: 730 }
  ];
  const fontSurfaceOptions: Array<{
    id: keyof SettingsSnapshot["perSurfaceFontOverrides"];
    label: string;
  }> = [
    { id: "markdownEditor", label: "Markdown editor" },
    { id: "sidebar", label: "Sidebar" },
    { id: "calendarGrid", label: "Calendar grid" },
    { id: "taskList", label: "Task list" },
    { id: "inspector", label: "Inspector" },
    { id: "menuBar", label: "Menu bar" }
  ];
  const selectedTaskLists = new Set(settings.selectedTaskListIds);
  const selectedCalendars = new Set(settings.selectedCalendarIds);

  function updateNavigationTab(tabId: "tasks" | "calendar" | "notes", visible: boolean): void {
    const hidden = new Set(settings.hiddenNavigationTabs);

    if (visible) {
      hidden.delete(tabId);
    } else {
      hidden.add(tabId);
    }

    if (navigationTabs.every((tab) => hidden.has(tab.id))) {
      return;
    }

    updateSettings({ hiddenNavigationTabs: [...hidden] });
  }

  function updateCalendarViewMode(
    viewId: "agenda" | "day" | "multiDay" | "week" | "month",
    visible: boolean
  ): void {
    const hidden = new Set(settings.hiddenCalendarViewModes);

    if (visible) {
      hidden.delete(viewId);
    } else {
      hidden.add(viewId);
    }

    if (calendarViewModes.every((mode) => hidden.has(mode.id))) {
      return;
    }

    updateSettings({ hiddenCalendarViewModes: [...hidden] });
  }

  function retentionPresetValue(daysBack: number): string {
    return retentionOptions.some((option) => option.value === daysBack) ? String(daysBack) : "custom";
  }

  function customRetentionDays(): number {
    const amount = Math.max(1, Math.round(Number(customRetentionAmount) || 1));

    if (customRetentionUnit === "years") {
      return Math.min(3650, amount * 365);
    }

    if (customRetentionUnit === "months") {
      return Math.min(3650, amount * 30);
    }

    return Math.min(3650, amount);
  }

  function applyCustomRetention(): void {
    const days = customRetentionDays();

    updateSettings({
      eventRetentionDaysBack: days,
      completedTaskRetentionDaysBack: days
    });
  }

  function updatePerSurfaceFont(
    surface: keyof SettingsSnapshot["perSurfaceFontOverrides"],
    patch: Partial<SettingsSnapshot["perSurfaceFontOverrides"][typeof surface]>
  ): void {
    const current = settings.perSurfaceFontOverrides[surface] ?? {
      uiFontName: null,
      uiTextSizePoints: null
    };

    updateSettings({
      perSurfaceFontOverrides: {
        ...settings.perSurfaceFontOverrides,
        [surface]: {
          ...current,
          ...patch
        }
      }
    });
  }

  function resetPerSurfaceFont(surface: keyof SettingsSnapshot["perSurfaceFontOverrides"]): void {
    const next = { ...settings.perSurfaceFontOverrides };
    delete next[surface];
    updateSettings({ perSurfaceFontOverrides: next });
  }

  const account = googleStatus.account;
  const accountLabel = account?.displayName || account?.email || "Not connected";
  const accountDetail = account?.email ?? account?.connectionState ?? "Google account is not connected";

  return (
    <div className="grid min-h-0 gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border bg-bg-secondary px-2 pb-3">
        <SettingsTabButton
          active={selectedSettingsTab === "general"}
          icon={Settings2}
          label="General"
          onClick={() => setSelectedSettingsTab("general")}
        />
        <SettingsTabButton
          active={selectedSettingsTab === "profile"}
          icon={Users}
          label="Profile"
          onClick={() => setSelectedSettingsTab("profile")}
        />
        <SettingsTabButton
          active={selectedSettingsTab === "appearance"}
          icon={Brush}
          label="Appearance"
          onClick={() => setSelectedSettingsTab("appearance")}
        />
      </div>

      {source.settingsMutationError ? (
        <StatusBanner
          description={source.settingsMutationError}
          title="Settings action not applied"
          tone="warning"
        />
      ) : null}
      {recoveryMessage ? (
        <StatusBanner description={recoveryMessage} title="Settings action applied" tone="success" />
      ) : null}
      {confirmation ? (
        <Panel title="Confirm destructive action" description={confirmation.action}>
          <div className="grid gap-3 p-3">
            <Input
              aria-label="Confirmation phrase"
              onChange={(event) => setConfirmationInput(event.target.value)}
              placeholder={confirmation.phrase}
              value={confirmationInput}
            />
            <div className="flex items-center gap-2">
              <Button
                disabled={confirmationInput !== confirmation.phrase || source.settingsMutationPending}
                onClick={confirmRecoveryAction}
                variant="danger"
              >
                Confirm
              </Button>
              <Button onClick={() => setConfirmation(null)} variant="ghost">
                Cancel
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {selectedSettingsTab === "general" ? (
        <div className="grid gap-5">
          <SettingsGroup title="Language">
            <SettingsControlRow
              description="System Default follows your macOS language order."
              icon={Languages}
              label="App language"
            >
              <select
                aria-label="App language"
                className={settingsSelectClass}
                onChange={(event) =>
                  updateSettings({ appLanguage: event.target.value as SettingsSnapshot["appLanguage"] })
                }
                value={settings.appLanguage}
              >
                <option value="system">System Default</option>
                <option value="en">English</option>
              </select>
            </SettingsControlRow>
          </SettingsGroup>

          <SettingsGroup title="Startup">
            <SettingsSwitch
              checked={settings.startOnLogin}
              description="Starts the app automatically when you sign in to this Mac."
              icon={Power}
              label="Open Hot Cross Buns at login"
              onChange={(checked) => updateSettings({ startOnLogin: checked })}
            />
          </SettingsGroup>

          <SettingsGroup title="Diagnostics">
            <SettingsControlRow
              description="Inspect logs, mutation history, sync queues, and support bundles."
              icon={ShieldCheck}
              label="Diagnostics"
            >
              <Button onClick={() => void openDiagnosticsDetails()} variant="secondary">
                <Copy aria-hidden="true" size={14} />
                Open diagnostics
              </Button>
            </SettingsControlRow>
            <SettingsSwitch
              checked={settings.diagnosticsIncludePerformance}
              description="Includes startup, migration, slow query, and MCP request timings in diagnostics."
              label="Include performance diagnostics"
              onChange={(checked) => updateSettings({ diagnosticsIncludePerformance: checked })}
            />
            <SettingsSwitch
              checked={settings.rawGoogleDiagnosticsEnabled}
              description="Future local logs may include field-redacted Google troubleshooting snippets."
              label="Include field-redacted Google payloads in local logs"
              onChange={(checked) => updateSettings({ rawGoogleDiagnosticsEnabled: checked })}
            />
          </SettingsGroup>

          <SettingsGroup title="Agent access">
            <SettingsSwitch
              checked={settings.mcpEnabled}
              icon={Server}
              label="Local MCP server"
              onChange={(checked) => updateSettings({ mcpEnabled: checked })}
            />
            <SettingsControlRow
              description="MCP clients must follow this write policy before changes apply."
              label="Permission mode"
            >
              <select
                aria-label="MCP permission mode"
                className={settingsSelectClass}
                onChange={(event) =>
                  updateSettings({
                    mcpPermissionMode: event.target.value as SettingsSnapshot["mcpPermissionMode"]
                  })
                }
                value={settings.mcpPermissionMode}
              >
                <option value="read-only">Read-only</option>
                <option value="confirm-writes">Confirm writes</option>
                <option value="allow-writes">Allow writes</option>
              </select>
            </SettingsControlRow>
            <SettingsControlRow label="Port">
              <Input
                aria-label="MCP port"
                max={65535}
                min={0}
                onBlur={(event) => updateSettings({ mcpPort: Number(event.currentTarget.value) || 0 })}
                defaultValue={String(settings.mcpPort)}
                type="number"
              />
            </SettingsControlRow>
            <SettingsControlRow
              description={settings.mcpEnabled ? "The local MCP server is enabled." : "The local MCP server is disabled."}
              label={settings.mcpEnabled ? "Running" : "Stopped"}
            >
              <Button
                disabled={source.settingsMutationPending}
                onClick={() => beginRecoveryAction("resetMcpToken")}
                variant="secondary"
              >
                <RotateCcw aria-hidden="true" size={14} />
                Reset token
              </Button>
            </SettingsControlRow>
          </SettingsGroup>

          <SettingsGroup title="Sync">
            <SettingsControlRow
              description="Refresh cadence for launch, foreground, and periodic app activity."
              label="Mode"
            >
              <select
                aria-label="Sync mode"
                className={settingsSelectClass}
                onChange={(event) =>
                  updateSettings({ syncMode: event.target.value as SettingsSnapshot["syncMode"] })
                }
                value={settings.syncMode}
              >
                <option value="manual">Manual</option>
                <option value="balanced">Balanced</option>
                <option value="near-real-time">Near real-time</option>
              </select>
            </SettingsControlRow>
            <SettingsControlRow label="Keep past events">
              <select
                aria-label="Keep past events"
                className={settingsSelectClass}
                onChange={(event) => {
                  if (event.target.value !== "custom") {
                    updateSettings({ eventRetentionDaysBack: Number(event.target.value) });
                  }
                }}
                value={retentionPresetValue(settings.eventRetentionDaysBack)}
              >
                {retentionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </SettingsControlRow>
            <SettingsControlRow label="Keep completed tasks">
              <select
                aria-label="Keep completed tasks"
                className={settingsSelectClass}
                onChange={(event) => {
                  if (event.target.value !== "custom") {
                    updateSettings({ completedTaskRetentionDaysBack: Number(event.target.value) });
                  }
                }}
                value={retentionPresetValue(settings.completedTaskRetentionDaysBack)}
              >
                {retentionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </SettingsControlRow>
            <SettingsControlRow
              description="Applies the same retention window to cached past events and completed tasks."
              label="Custom"
            >
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <Input
                  aria-label="Custom retention amount"
                  className="w-24"
                  min={1}
                  onChange={(event) => setCustomRetentionAmount(event.currentTarget.value)}
                  type="number"
                  value={customRetentionAmount}
                />
                <select
                  aria-label="Custom retention unit"
                  className={settingsSelectClass}
                  onChange={(event) => setCustomRetentionUnit(event.target.value as "days" | "months" | "years")}
                  value={customRetentionUnit}
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
                <Button onClick={applyCustomRetention} variant="primary">Apply</Button>
              </div>
            </SettingsControlRow>
            <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
              <Button onClick={() => beginRecoveryAction("refresh")} variant="secondary">
                <RotateCcw aria-hidden="true" size={14} />
                Refresh
              </Button>
              <Button onClick={() => beginRecoveryAction("forceFullResync")} variant="danger">
                Force full resync
              </Button>
            </div>
          </SettingsGroup>

          <SettingsGroup title="Setup">
            <SettingsControlRow
              description="Clears onboarding completion so setup opens again."
              icon={Sparkles}
              label="Setup assistant"
            >
              <Button onClick={() => beginRecoveryAction("resetOnboarding")} variant="secondary">
                Run setup again
              </Button>
            </SettingsControlRow>
          </SettingsGroup>
        </div>
      ) : null}

      {selectedSettingsTab === "profile" ? (
        <div className="grid gap-5">
          <SettingsGroup title="Google OAuth client">
            <SettingsControlRow
              description={googleStatus.oauthClientConfigured ? "Google Cloud OAuth client saved." : "Missing"}
              icon={ShieldCheck}
              label="Google Cloud OAuth client"
            >
              <Badge tone={googleStatus.oauthClientConfigured ? "success" : "warning"}>
                {googleStatus.oauthClientConfigured ? "Configured" : "Missing"}
              </Badge>
            </SettingsControlRow>
            <SettingsControlRow label="Desktop OAuth client ID">
              <Input
                aria-label="Google OAuth client ID"
                onChange={(event) => setGoogleClientId(event.currentTarget.value)}
                placeholder="Client ID from Google Cloud Console"
                value={googleClientId}
              />
            </SettingsControlRow>
            <SettingsControlRow label="Client secret (optional)">
              <Input
                aria-label="Google OAuth client secret"
                onChange={(event) => setGoogleClientSecret(event.currentTarget.value)}
                placeholder={googleStatus.hasClientSecret ? "Stored in Keychain" : "Optional for Desktop clients"}
                type="password"
                value={googleClientSecret}
              />
            </SettingsControlRow>
            <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
              <Button
                disabled={googleClientId.trim().length < 10 || source.settingsMutationPending}
                onClick={() => void saveGoogleOAuthClient()}
                variant="primary"
              >
                <Save aria-hidden="true" size={14} />
                Save OAuth Client
              </Button>
              <Button onClick={() => setGoogleClientSecret("")} variant="secondary">
                <Trash2 aria-hidden="true" size={14} />
                Clear
              </Button>
            </div>
          </SettingsGroup>

          <SettingsGroup title="Google accounts">
            <SettingsControlRow
              description={accountDetail}
              icon={Users}
              label={accountLabel}
            >
              <Badge tone={account?.connectionState === "connected" ? "success" : "warning"}>
                {account?.connectionState === "connected" ? "Active" : "Disconnected"}
              </Badge>
            </SettingsControlRow>
            <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
              <Button
                disabled={!googleStatus.oauthClientConfigured}
                onClick={() => void beginGoogleOAuth()}
                variant="primary"
              >
                <Users aria-hidden="true" size={14} />
                Add Google Account
              </Button>
              <Button disabled={!account} onClick={() => void disconnectGoogle()} variant="secondary">
                Disconnect
              </Button>
            </div>
          </SettingsGroup>

          <SettingsGroup title="Task lists">
            {source.taskLists.length === 0 ? (
              <EmptyState description="No task lists are cached yet." title="No task lists" />
            ) : source.taskLists.map((taskList) => (
              <SettingsSwitch
                checked={selectedTaskLists.size === 0 || selectedTaskLists.has(taskList.id)}
                key={taskList.id}
                label={taskList.title}
                onChange={(checked) => updateSelectedTaskList(taskList.id, checked)}
                trailing={<Badge>{taskList.activeTaskCount ?? taskList.taskCount ?? 0}</Badge>}
              />
            ))}
          </SettingsGroup>

          <SettingsGroup title="Calendars">
            {source.calendarSources.length === 0 ? (
              <EmptyState description="No calendars are cached yet." title="No calendars" />
            ) : source.calendarSources.map((calendar) => (
              <SettingsSwitch
                checked={selectedCalendars.size === 0 ? calendar.selected : selectedCalendars.has(calendar.id)}
                description={calendar.timeZone ?? undefined}
                key={calendar.id}
                label={calendar.title}
                onChange={(checked) => updateSelectedCalendar(calendar.id, checked)}
                trailing={<Badge>{calendar.eventCount ?? 0}</Badge>}
              />
            ))}
          </SettingsGroup>
        </div>
      ) : null}

      {selectedSettingsTab === "appearance" ? (
        <div className="grid gap-5">
          <SettingsGroup title="Appearance">
            <SettingsControlRow
              description="Choose whether app chrome resolves as dark, light, or follows macOS."
              label="Base colour scheme"
            >
              <select
                aria-label="Theme"
                className={settingsSelectClass}
                onChange={(event) => updateBaseTheme(event.target.value as SettingsSnapshot["theme"])}
                value={settings.theme}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </SettingsControlRow>
            <SettingsControlRow
              description="Palette used by cards, text, and app surfaces."
              label="Theme"
            >
              <select
                aria-label="Color theme"
                className={settingsSelectClass}
                onChange={(event) => updateSettings({ colorTheme: event.target.value as AppColorThemeId })}
                value={activeColorTheme.id}
              >
                {matchingColorThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.title}
                  </option>
                ))}
              </select>
            </SettingsControlRow>
            <SettingsControlRow
              description="Snappy uses shorter transitions; Rich uses longer app motion."
              label="Performance"
            >
              <SegmentedControl
                options={[
                  { label: "Snappy", value: "snappy" },
                  { label: "Rich", value: "rich" }
                ]}
                onChange={(value) =>
                  updateSettings({ performanceMode: value as SettingsSnapshot["performanceMode"] })
                }
                value={settings.performanceMode}
              />
            </SettingsControlRow>
            <SettingsSwitch
              checked={settings.appBackgroundTranslucencyEnabled}
              description="Allows the app shell background to use the configured opacity."
              label="Translucent background"
              onChange={(checked) => updateSettings({ appBackgroundTranslucencyEnabled: checked })}
            />
            <SettingsControlRow label="App surface opacity">
              <div className="flex min-w-0 items-center gap-3">
                <input
                  aria-label="App surface opacity"
                  className="w-56 accent-[var(--color-accent)]"
                  max={1}
                  min={0.35}
                  onChange={(event) => updateSettings({ appBackgroundOpacity: Number(event.target.value) })}
                  step={0.05}
                  type="range"
                  value={settings.appBackgroundOpacity}
                />
                <span className="w-12 text-right font-mono text-[var(--text-xs)] text-text-muted">
                  {Math.round(settings.appBackgroundOpacity * 100)}%
                </span>
              </div>
            </SettingsControlRow>
            <SettingsSwitch
              checked={settings.disableAnimations}
              description="Turns off app-driven transitions, panel motion, and animated state changes."
              label="Disable animations"
              onChange={(checked) => updateSettings({ disableAnimations: checked })}
            />
            <SettingsControlRow label="Layout scale">
              <div className="flex min-w-0 items-center gap-3">
                <input
                  aria-label="Layout scale"
                  className="w-56 accent-[var(--color-accent)]"
                  max={1.5}
                  min={0.8}
                  onChange={(event) => updateSettings({ uiLayoutScale: Number(event.target.value) })}
                  step={0.05}
                  type="range"
                  value={settings.uiLayoutScale}
                />
                <span className="w-12 text-right font-mono text-[var(--text-xs)] text-text-muted">
                  {Math.round(settings.uiLayoutScale * 100)}%
                </span>
              </div>
            </SettingsControlRow>
            <SettingsControlRow label="Text size">
              <div className="flex min-w-0 items-center gap-3">
                <Input
                  aria-label="Text size points"
                  className="w-24"
                  max={24}
                  min={9}
                  onChange={(event) =>
                    updateSettings({
                      uiTextSizePoints: Math.min(24, Math.max(9, Number(event.target.value) || 13))
                    })
                  }
                  type="number"
                  value={settings.uiTextSizePoints}
                />
                <Button onClick={() => updateSettings({ uiTextSizePoints: 13 })} variant="ghost">
                  Reset
                </Button>
              </div>
            </SettingsControlRow>
            <SettingsControlRow label="UI font">
              <select
                aria-label="Font family"
                className={settingsSelectClass}
                onChange={(event) =>
                  updateSettings({
                    uiFontName: event.target.value.trim() ? event.target.value : null
                  })
                }
                value={settings.uiFontName ?? ""}
              >
                <option value="">System</option>
                {availableFontFamilies.map((fontName) => (
                  <option key={fontName} value={fontName}>
                    {fontName}
                  </option>
                ))}
              </select>
            </SettingsControlRow>
          </SettingsGroup>

          <SettingsGroup title="Per-surface fonts">
            {fontSurfaceOptions.map((surface) => {
              const override = settings.perSurfaceFontOverrides[surface.id];

              return (
                <SettingsControlRow key={surface.id} label={surface.label}>
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                    <select
                      aria-label={`${surface.label} font`}
                      className={settingsSelectClass}
                      onChange={(event) =>
                        updatePerSurfaceFont(surface.id, {
                          uiFontName: event.target.value.trim() ? event.target.value : null
                        })
                      }
                      value={override?.uiFontName ?? ""}
                    >
                      <option value="">(inherit)</option>
                      {availableFontFamilies.map((fontName) => (
                        <option key={fontName} value={fontName}>
                          {fontName}
                        </option>
                      ))}
                    </select>
                    <Input
                      aria-label={`${surface.label} size`}
                      className="w-20"
                      max={24}
                      min={9}
                      onChange={(event) =>
                        updatePerSurfaceFont(surface.id, {
                          uiTextSizePoints: event.target.value ? Number(event.target.value) : null
                        })
                      }
                      placeholder="Size"
                      type="number"
                      value={override?.uiTextSizePoints ?? ""}
                    />
                    <Button onClick={() => resetPerSurfaceFont(surface.id)} variant="ghost">
                      Reset
                    </Button>
                  </div>
                </SettingsControlRow>
              );
            })}
          </SettingsGroup>

          <SettingsGroup title="Layout">
            <SettingsControlRow
              description="Left keeps the native sidebar placement; right moves the same tabs around the current view."
              label="Navigation placement"
            >
              <SegmentedControl
                options={[
                  { label: "Left", value: "left", icon: PanelLeft },
                  { label: "Right", value: "right", icon: PanelRight }
                ]}
                onChange={(value) =>
                  updateSettings({ navigationPlacement: value as SettingsSnapshot["navigationPlacement"] })
                }
                value={settings.navigationPlacement}
              />
            </SettingsControlRow>
            <div className="grid gap-1 border-b border-border px-3 py-3 last:border-b-0">
              <h3 className="text-[var(--text-md)] font-semibold text-text-primary">Navigation tabs</h3>
              {navigationTabs.map((tab) => (
                <SettingsSwitch
                  checked={!settings.hiddenNavigationTabs.includes(tab.id)}
                  key={tab.id}
                  label={tab.label}
                  onChange={(checked) => updateNavigationTab(tab.id, checked)}
                />
              ))}
            </div>
            <div className="grid gap-1 border-b border-border px-3 py-3 last:border-b-0">
              <h3 className="text-[var(--text-md)] font-semibold text-text-primary">Calendar view modes</h3>
              {calendarViewModes.map((mode) => (
                <SettingsSwitch
                  checked={!settings.hiddenCalendarViewModes.includes(mode.id)}
                  key={mode.id}
                  label={mode.label}
                  onChange={(checked) => updateCalendarViewMode(mode.id, checked)}
                />
              ))}
            </div>
            <SettingsControlRow
              description="Month view will not navigate beyond these loaded month bounds."
              label="Month scroll range"
            >
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <span className="text-[var(--text-sm)] text-text-muted">Past</span>
                <Input
                  aria-label="Past months"
                  className="w-20"
                  max={24}
                  min={0}
                  onChange={(event) => updateSettings({ monthScrollPastMonths: Number(event.target.value) || 0 })}
                  type="number"
                  value={settings.monthScrollPastMonths}
                />
                <span className="text-[var(--text-sm)] text-text-muted">Future</span>
                <Input
                  aria-label="Future months"
                  className="w-20"
                  max={24}
                  min={0}
                  onChange={(event) => updateSettings({ monthScrollFutureMonths: Number(event.target.value) || 0 })}
                  type="number"
                  value={settings.monthScrollFutureMonths}
                />
              </div>
            </SettingsControlRow>
            <SettingsSwitch
              checked={settings.quickCreateExpandedByDefault}
              description="Calendar quick creation opens with optional fields visible when supported."
              label="Show all quick-create fields by default"
              onChange={(checked) => updateSettings({ quickCreateExpandedByDefault: checked })}
            />
            <SettingsSwitch
              checked={settings.restoreWindowStateEnabled}
              description="Keeps window restoration enabled across app launches."
              label="Restore previous session"
              onChange={(checked) => updateSettings({ restoreWindowStateEnabled: checked })}
            />
          </SettingsGroup>
        </div>
      ) : null}
    </div>
  );
}

const settingsSelectClass =
  "h-8 rounded-hcbMd border border-border bg-surface-0 px-2 text-[var(--text-base)] text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function SettingsTabButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  icon: typeof Settings2;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      aria-pressed={active}
      className={cx(
        "grid min-h-20 min-w-24 place-items-center gap-1 rounded-hcbLg border px-4 py-2 text-center transition-colors duration-fast ease-hcb focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active
          ? "border-border bg-surface-0 text-accent"
          : "border-transparent text-text-muted hover:bg-surface-0 hover:text-text-primary"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={30} strokeWidth={2} />
      <span className="text-[var(--text-sm)] font-semibold">{label}</span>
    </button>
  );
}

function SettingsGroup({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <section className="grid gap-2">
      <h2 className="px-3 text-[var(--text-lg)] font-bold text-text-primary">{title}</h2>
      <div className="overflow-hidden rounded-hcbLg border border-border bg-bg-secondary">
        {children}
      </div>
    </section>
  );
}

function SettingsControlRow({
  children,
  description,
  icon: Icon,
  label
}: {
  children?: ReactNode;
  description?: string;
  icon?: typeof Settings2;
  label: string;
}): JSX.Element {
  return (
    <div className="grid min-h-14 gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-text-muted" size={18} />
        ) : null}
        <div className="min-w-0">
          <div className="truncate text-[var(--text-md)] font-semibold text-text-primary">{label}</div>
          {description ? (
            <p className="mt-1 text-[var(--text-sm)] text-text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? (
        <div className="flex min-w-0 items-center justify-start sm:justify-end">{children}</div>
      ) : null}
    </div>
  );
}

function SettingsSwitch({
  checked,
  description,
  icon,
  label,
  onChange,
  trailing
}: {
  checked: boolean;
  description?: string;
  icon?: typeof Settings2;
  label: string;
  onChange: (checked: boolean) => void;
  trailing?: ReactNode;
}): JSX.Element {
  return (
    <SettingsControlRow description={description} icon={icon} label={label}>
      <div className="flex items-center gap-3">
        {trailing}
        <input
          aria-label={label}
          checked={checked}
          className="h-5 w-9 accent-[var(--color-accent)]"
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
      </div>
    </SettingsControlRow>
  );
}

function SegmentedControl({
  onChange,
  options,
  value
}: {
  onChange: (value: string) => void;
  options: Array<{ icon?: typeof Settings2; label: string; value: string }>;
  value: string;
}): JSX.Element {
  return (
    <div className="inline-flex max-w-full overflow-hidden rounded-hcbMd border border-border bg-surface-0 p-1">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;

        return (
          <button
            aria-pressed={active}
            className={cx(
              "inline-flex h-7 min-w-20 items-center justify-center gap-2 rounded-hcbSm px-3 text-[var(--text-sm)] font-semibold transition-colors duration-fast ease-hcb focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active ? "bg-accent text-bg-tertiary" : "text-text-secondary hover:bg-surface-1 hover:text-text-primary"
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {Icon ? <Icon aria-hidden="true" size={14} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function timeZoneOptions(values: Array<string | null | undefined>): string[] {
  const system = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const seen = new Set<string>();
  const options: string[] = [];

  for (const value of [...values, system, "UTC"]) {
    const trimmed = value?.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    options.push(trimmed);
  }

  return options;
}

function recoveryPhrase(action: SettingsRecoveryActionRequest["action"]): string {
  if (action === "forceFullResync") {
    return "FULL RESYNC";
  }

  if (action === "clearGoogleCache") {
    return "CLEAR CACHE";
  }

  if (action === "resetMcpToken") {
    return "RESET MCP TOKEN";
  }

  return "";
}

function SettingsRows({
  rows,
  status
}: {
  rows: Array<{ id: string; label: string; value: string }>;
  status: string;
}): JSX.Element {
  return (
    <div role="list">
      {rows.map((row) => (
        <ListRow
          description={row.value}
          key={row.id}
          title={row.label}
          trailing={<Badge tone={settingTone(status)}>{status}</Badge>}
        />
      ))}
    </div>
  );
}

function SettingsToggle({
  actionId,
  checked,
  label,
  onChange
}: {
  actionId?: PlannerActionId;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label
      className="flex min-h-9 items-center gap-2 rounded-hcbMd border border-border bg-bg-tertiary px-3 text-[var(--text-sm)] text-text-secondary"
      data-action-id={actionId}
    >
      <input
        checked={checked}
        className="accent-[var(--color-accent)]"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}
