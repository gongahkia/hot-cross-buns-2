import { _electron as electron, expect, test, type ElectronApplication } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runLocalDataMigrations } from "../../src/main/data/migrations";
import { createAppSqliteConnection } from "../../src/main/data/sqliteConnection";
import { GoogleSyncRepository } from "../../src/main/sync/readSyncRepository";

const now = "2026-05-22T00:00:00.000Z";

function seedSmokeDatabase(appSupportDirectory: string): void {
  const connection = createAppSqliteConnection({ appSupportDirectory });

  try {
    runLocalDataMigrations(connection);
    const syncRepository = new GoogleSyncRepository(connection);

    syncRepository.upsertAccountStatus({
      accountId: "acct-smoke",
      googleAccountId: "google-smoke",
      email: "smoke@example.com",
      displayName: "Smoke Account",
      avatarUrl: null,
      locale: "en-US",
      timeZone: "UTC",
      connectionState: "connected",
      grantedScopes: [
        "https://www.googleapis.com/auth/tasks",
        "https://www.googleapis.com/auth/calendar"
      ],
      missingScopes: [],
      lastAuthenticatedAt: now,
      updatedAt: now
    });
    syncRepository.writeTaskLists(
      "acct-smoke",
      [
        {
          id: "inbox",
          title: "Inbox",
          updatedAt: now
        }
      ],
      now
    );
    syncRepository.writeTasks(
      "acct-smoke",
      "inbox",
      [
        {
          id: "task-seeded",
          taskListId: "inbox",
          title: "Seeded smoke task",
          notes: "Existing local mirror row.",
          status: "needsAction",
          dueAt: now,
          deleted: false,
          hidden: false,
          updatedAt: now
        }
      ],
      {
        fullSync: true,
        now
      }
    );
    syncRepository.writeCalendarLists(
      "acct-smoke",
      [
        {
          id: "primary",
          summary: "Primary",
          timeZone: "UTC",
          isSelected: true,
          isHidden: false,
          isPrimary: true,
          updatedAt: now
        }
      ],
      now
    );
  } finally {
    connection.close();
  }
}

test("launches, navigates, opens command palette, and creates core items", async () => {
  let electronApp: ElectronApplication | undefined;
  const tempRoot = mkdtempSync(join(tmpdir(), "hcb2-smoke-"));
  const userDataDir = join(tempRoot, "user-data");

  try {
    seedSmokeDatabase(userDataDir);
    electronApp = await electron.launch({
      args: [resolve(__dirname, "../..")],
      env: {
        ...process.env,
        HCB_USER_DATA_DIR: userDataDir,
        NODE_ENV: "test"
      }
    });

    const page = await electronApp.firstWindow();

    await expect(page.getByTestId("app-shell")).toBeVisible();
    await expect(page.locator("#planner-title")).toHaveText("Today");
    const firstRunSetup = page.getByRole("dialog", { name: "First-run setup" });

    await expect(firstRunSetup).toBeVisible();
    await firstRunSetup.getByRole("button", { name: "Finish setup" }).click();
    await expect(firstRunSetup).toBeHidden();

    for (const label of ["Today", "Tasks", "Calendar", "Notes", "Search", "Settings"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${label}\\b`) })).toBeVisible();
    }

    for (const label of ["Tasks", "Calendar", "Notes", "Search", "Settings", "Today"]) {
      await page.getByRole("button", { name: new RegExp(`^${label}\\b`) }).click();
      await expect(page.locator("#planner-title")).toHaveText(label);
    }

    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Filter commands" }).fill("quick capture");
    await page.keyboard.press("Enter");
    await expect(page.locator("#planner-title")).toHaveText("Tasks");
    await expect(page.getByRole("textbox", { name: "Quick capture task" })).toBeVisible();

    await page
      .getByRole("textbox", { name: "Quick capture task" })
      .fill("Smoke quick capture today #Inbox");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /Smoke quick capture/ }).first()).toBeVisible();

    await page.getByRole("button", { name: /^New task$/ }).click();
    await page.getByRole("textbox", { name: "Task title" }).fill("Smoke UI task");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByRole("button", { name: /Smoke UI task/ }).first()).toBeVisible();

    await page.getByRole("button", { name: /^Calendar\b/ }).click();
    await page.getByRole("button", { name: /^New event$/ }).click();
    await page.getByRole("textbox", { name: "Event title" }).fill("Smoke UI event");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Smoke UI event" })).toBeVisible();

    await page.getByRole("button", { name: /^Notes\b/ }).click();
    await page.getByRole("button", { name: /^New note$/ }).click();
    await page.getByRole("textbox", { name: "Note title" }).fill("Smoke UI note");
    await page.getByRole("textbox", { name: "Note body" }).fill("Created by smoke test.");
    await page.getByRole("textbox", { name: "Note body" }).blur();
    await expect(page.getByRole("textbox", { name: "Note title" })).toHaveValue("Smoke UI note");

    const health = await page.evaluate(async () => globalThis.window.hcb?.diagnostics.health());
    expect(health?.ok).toBe(true);
    expect(health?.ok ? health.data.startup.databaseReadyMs : undefined).toBeDefined();
  } finally {
    await electronApp?.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
