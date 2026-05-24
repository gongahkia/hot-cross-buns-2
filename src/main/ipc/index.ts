import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "@shared/ipc/contracts";
import type { ServiceContainer } from "../services/serviceContainer";
import { createCoreIpcHandlers } from "./coreHandlers";
import { createDiagnosticsIpcHandlers } from "./diagnostics";
import { createIpcMetrics, registerIpcDispatcher } from "./registry";

export interface HcbIpcLifecycleHooks {
  onShellVisible?: () => void;
}

export function registerHcbIpc(
  services: ServiceContainer,
  lifecycleHooks: HcbIpcLifecycleHooks = {}
): void {
  const metrics = createIpcMetrics();

  registerIpcDispatcher(
    ipcMain,
    [
      ...createDiagnosticsIpcHandlers(metrics, services.performance, services, lifecycleHooks),
      ...createCoreIpcHandlers(services.domain)
    ],
    {
      metrics
    }
  );

  services.domain.sync.subscribeStatus?.((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.syncStatus, status);
    }
  });
}
