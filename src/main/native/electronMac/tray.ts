import {
  Menu,
  Tray,
  app,
  nativeImage,
  type MenuItemConstructorOptions,
  type NativeImage
} from "electron";
import { brandImage } from "../brandAssets";
import type {
  NativeMenuBarItem,
  NativeMenuBarSnapshot,
  NativeOperationResult,
  NativeTrayActions
} from "../types";
import { MenuBarPanelController } from "./menuBarPanelController";
import { unsupported } from "./operationResults";

const fallbackTrayIconBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOUlEQVR4nGNgGArgP7macGGyDSHZufgMwGkgPqcT5SKKDCBFM1UMoV0gUmQAPu+QBKiSEklyLtkAAHbWV6m7KwjdAAAAAElFTkSuQmCC";

type MenuBarIconName = NativeMenuBarSnapshot["iconName"];

const templateIconSvgBodies: Record<MenuBarIconName, string> = {
  bell: '<path d="M5.1 7.7a3.9 3.9 0 0 1 7.8 0c0 3 1.4 3.8 1.4 3.8H3.7s1.4-.8 1.4-3.8Z"/><path d="M7.5 13.5a1.8 1.8 0 0 0 3 0"/>',
  bolt: '<path d="M10.1 1.9 4.6 9.6h3.7l-.4 6.5 5.5-7.7H9.7l.4-6.5Z"/>',
  bun: '<circle cx="9" cy="9" r="6.2"/><path d="M9 3.2v11.6"/><path d="M3.2 9h11.6"/>',
  calendar: '<rect x="3" y="4.1" width="12" height="10.6" rx="2"/><path d="M6 2.7v3"/><path d="M12 2.7v3"/><path d="M3 7.3h12"/><path d="M6.2 10h.1"/><path d="M9 10h.1"/><path d="M11.8 10h.1"/>',
  checklist: '<rect x="3.2" y="2.8" width="11.6" height="12.4" rx="2"/><path d="m5.6 7 1.1 1.1 2-2"/><path d="M10.2 7.1h2.1"/><path d="m5.6 11.5 1.1 1.1 2-2"/><path d="M10.2 11.6h2.1"/>',
  circle: '<circle cx="9" cy="9" r="5.7"/>',
  clock: '<circle cx="9" cy="9" r="6.1"/><path d="M9 5.3V9l2.7 1.6"/>',
  diamond: '<path d="M9 2.4 15.6 9 9 15.6 2.4 9 9 2.4Z"/>',
  spark: '<path d="M9 2.3 10.6 7 15.3 9 10.6 11 9 15.7 7.4 11 2.7 9 7.4 7 9 2.3Z"/><path d="M13.8 2.8v2.5"/><path d="M12.6 4h2.5"/>',
  star: '<path d="m9 2.8 1.7 3.5 3.9.6-2.8 2.7.7 3.8L9 11.6l-3.5 1.8.7-3.8L3.4 6.9l3.9-.6L9 2.8Z"/>',
  target: '<circle cx="9" cy="9" r="6.2"/><circle cx="9" cy="9" r="2.6"/><path d="M9 1.9v2"/><path d="M9 14.1v2"/><path d="M1.9 9h2"/><path d="M14.1 9h2"/>'
};

export class MacTrayController {
  private tray: Tray | undefined;
  private trayRefreshTimer: NodeJS.Timeout | undefined;
  private readonly menuBarPanel = new MenuBarPanelController();

  create(actions: NativeTrayActions): NativeOperationResult {
    if (process.platform !== "darwin") {
      return unsupported("macOS menu bar item is unavailable on this platform.");
    }

    try {
      const image = trayIconImage(actions.snapshot().iconName);
      image.setTemplateImage(true);
      this.tray?.destroy();
      this.clearRefreshTimer();
      this.tray = new Tray(image);
      this.tray.setIgnoreDoubleClickEvents(true);
      this.refreshPresentation(actions);
      this.tray.on("click", () => {
        void this.handlePrimaryClick(actions);
      });
      this.tray.on("right-click", () => {
        this.refreshPresentation(actions);
        this.tray?.popUpContextMenu(trayUtilityMenu(actions));
      });
      this.trayRefreshTimer = setInterval(() => {
        this.refreshPresentation(actions);
      }, 60_000);
      this.trayRefreshTimer.unref?.();

      return {
        ok: true,
        state: "ready",
        message: "macOS menu bar item is installed."
      };
    } catch (error) {
      return {
        ok: false,
        state: "error",
        message: error instanceof Error ? error.message : "Could not create the menu bar item."
      };
    }
  }

  destroy(): void {
    this.menuBarPanel.destroy();
    this.clearRefreshTimer();
    this.tray?.destroy();
    this.tray = undefined;
    app.dock?.setBadge("");
  }

  private async handlePrimaryClick(actions: NativeTrayActions): Promise<void> {
    const snapshot = this.refreshPresentation(actions);

    if (snapshot.primaryClickAction === "open-menu") {
      if (!this.tray) {
        return;
      }

      try {
        await this.menuBarPanel.toggle(actions, snapshot, this.tray.getBounds());
      } catch {
        this.tray.popUpContextMenu(menuBarPanelMenu(actions, snapshot));
      }
      return;
    }

    actions.primaryClick();
  }

  private refreshPresentation(actions: NativeTrayActions): NativeMenuBarSnapshot {
    const snapshot = actions.snapshot();
    const image = trayIconImage(snapshot.iconName);
    image.setTemplateImage(true);
    const title = snapshot.statusLabel ?? snapshot.badgeLabel ?? "";

    this.tray?.setImage(image);
    this.tray?.setToolTip(snapshot.tooltip);
    this.tray?.setTitle(title);
    app.dock?.setBadge(snapshot.dockBadgeLabel ?? "");

    return snapshot;
  }

  private clearRefreshTimer(): void {
    if (!this.trayRefreshTimer) {
      return;
    }

    clearInterval(this.trayRefreshTimer);
    this.trayRefreshTimer = undefined;
  }
}

function trayIconImage(iconName: MenuBarIconName): NativeImage {
  if (iconName === "bun") {
    const image = brandImage("menubar-template.png");

    if (!image.isEmpty()) {
      return image;
    }
  }

  const image = nativeImage.createFromDataURL(templateIconDataUrl(iconName));

  return image.isEmpty()
    ? nativeImage.createFromDataURL(`data:image/png;base64,${fallbackTrayIconBase64}`)
    : image;
}

function templateIconDataUrl(iconName: MenuBarIconName): string {
  const body = templateIconSvgBodies[iconName];
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">',
    body,
    "</svg>"
  ].join("");

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function menuBarPanelMenu(actions: NativeTrayActions, snapshot: NativeMenuBarSnapshot): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: snapshot.title,
      sublabel: snapshot.subtitle,
      enabled: false
    }
  ];

  for (const section of snapshot.sections) {
    template.push({ type: "separator" });

    if (section.title) {
      template.push({
        label: section.title,
        enabled: false
      });
    }

    template.push(...section.items.map((item) => menuItemFromSnapshotItem(actions, item)));
  }

  template.push(
    { type: "separator" },
    {
      label: "Refresh Tasks and Calendar",
      click: actions.refresh
    },
    {
      label: "Open Hot Cross Buns 2",
      click: actions.openMainWindow
    },
    {
      label: "Settings",
      click: actions.openSettings
    },
    { type: "separator" },
    {
      label: "Quit",
      click: actions.quit
    }
  );

  return Menu.buildFromTemplate(template);
}

function trayUtilityMenu(actions: NativeTrayActions): Menu {
  return Menu.buildFromTemplate([
    {
      label: "Open Hot Cross Buns 2",
      click: actions.openMainWindow
    },
    {
      label: "Refresh Tasks and Calendar",
      click: actions.refresh
    },
    { type: "separator" },
    {
      label: "Settings",
      click: actions.openSettings
    },
    { type: "separator" },
    {
      label: "Quit",
      click: actions.quit
    }
  ]);
}

function menuItemFromSnapshotItem(
  actions: NativeTrayActions,
  item: NativeMenuBarItem
): MenuItemConstructorOptions {
  return {
    label: item.label,
    sublabel: item.detail,
    enabled: Boolean(item.route || item.action),
    click: () => {
      if (item.route) {
        actions.openRoute(item.route);
        return;
      }

      if (item.action === "refresh") {
        actions.refresh();
      } else if (item.action === "openSettings") {
        actions.openSettings();
      } else if (item.action === "showWindow") {
        actions.openMainWindow();
      }
    }
  };
}
