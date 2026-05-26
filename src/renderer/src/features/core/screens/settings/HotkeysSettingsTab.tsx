import { useState } from "react";
import type { KeyboardEvent } from "react";
import {
  defaultKeybindings,
  type HotkeyActionId,
  type SettingsSnapshot,
  type SettingsUpdateRequest
} from "@shared/ipc/contracts";
import { Keyboard, RotateCcw, X } from "lucide-react";
import { Button, cx } from "../../../../components/primitives";
import {
  acceleratorFromKeyboardEvent,
  displayAccelerator,
  duplicateAccelerators,
  hotkeyDefinitions
} from "../../hotkeys";
import { SettingsControlRow, SettingsGroup, settingsSearchMatches } from "./SettingsPrimitives";

interface HotkeysSettingsTabProps {
  query: string;
  settings: SettingsSnapshot;
  updateSettings: (request: SettingsUpdateRequest) => void;
}

export function HotkeysSettingsTab({
  query,
  settings,
  updateSettings
}: HotkeysSettingsTabProps): JSX.Element {
  const [recordingActionId, setRecordingActionId] = useState<HotkeyActionId | null>(null);
  const normalizedQuery = query.trim();
  const duplicateMap = duplicateAccelerators(settings.keybindings);
  const duplicateActionIds = new Set([...duplicateMap.values()].flat());
  const groups = ["App", "Navigation", "Calendar"] as const;

  function updateKeybinding(actionId: HotkeyActionId, accelerator: string | null): void {
    updateSettings({
      keybindings: {
        ...settings.keybindings,
        [actionId]: accelerator
      }
    });
  }

  function handleCapture(actionId: HotkeyActionId, event: KeyboardEvent<HTMLButtonElement>): void {
    if (recordingActionId !== actionId) {
      return;
    }

    event.preventDefault();

    if (event.key === "Escape") {
      setRecordingActionId(null);
      return;
    }

    const accelerator = acceleratorFromKeyboardEvent(event.nativeEvent);

    if (!accelerator) {
      return;
    }

    updateKeybinding(actionId, accelerator);
    setRecordingActionId(null);
  }

  return (
    <div className="grid gap-5">
      {groups.map((group) => {
        const definitions = hotkeyDefinitions.filter((definition) => {
          if (definition.group !== group) {
            return false;
          }

          if (!normalizedQuery) {
            return true;
          }

          return settingsSearchMatches(
            `${definition.label} ${definition.group} ${settings.keybindings[definition.id] ?? ""}`,
            normalizedQuery
          );
        });

        if (definitions.length === 0) {
          return null;
        }

        return (
          <SettingsGroup key={group} title={group}>
            {definitions.map((definition) => {
              const conflict = duplicateActionIds.has(definition.id);
              const recording = recordingActionId === definition.id;

              return (
                <SettingsControlRow
                  description={conflict ? "This shortcut is assigned to more than one action." : undefined}
                  icon={Keyboard}
                  key={definition.id}
                  label={definition.label}
                >
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                    <button
                      className={cx(
                        "min-w-28 rounded-hcbMd border px-3 py-1.5 font-mono text-[var(--text-sm)] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        conflict
                          ? "border-warning/70 bg-warning/10 text-warning"
                          : "border-border bg-surface-0 text-text-primary",
                        recording ? "border-accent text-accent" : ""
                      )}
                      onClick={() => setRecordingActionId(definition.id)}
                      onKeyDown={(event) => handleCapture(definition.id, event)}
                      type="button"
                    >
                      {recording ? "Press keys..." : displayAccelerator(settings.keybindings[definition.id])}
                    </button>
                    <Button
                      aria-label={`Reset ${definition.label}`}
                      onClick={() => updateKeybinding(definition.id, defaultKeybindings[definition.id])}
                      size="sm"
                      variant="ghost"
                    >
                      <RotateCcw aria-hidden="true" size={13} />
                    </Button>
                    <Button
                      aria-label={`Clear ${definition.label}`}
                      onClick={() => updateKeybinding(definition.id, null)}
                      size="sm"
                      variant="ghost"
                    >
                      <X aria-hidden="true" size={13} />
                    </Button>
                  </div>
                </SettingsControlRow>
              );
            })}
          </SettingsGroup>
        );
      })}
    </div>
  );
}
