import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const DEFAULT_RELEASE_DIR = "release";
const launchTimeoutMs = 12_000;
const requiredDesktopFields = new Map([
  ["Name", "Hot Cross Buns 2"],
  ["Type", "Application"],
  ["Terminal", "false"],
  ["Categories", "Office;"],
  ["GenericName", "Planner"],
  ["StartupWMClass", "hot-cross-buns-2"]
]);

function argValue(name: string, fallback: string): string {
  const prefix = `${name}=`;
  const directIndex = process.argv.indexOf(name);

  if (directIndex >= 0 && process.argv[directIndex + 1]) {
    return process.argv[directIndex + 1];
  }

  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length) ?? fallback;
}

async function main(): Promise<void> {
  const releaseDir = resolve(process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : argValue("--dir", DEFAULT_RELEASE_DIR));
  const artifact = resolve(argValue("--artifact", join(releaseDir, latestAppImageNameHint())));
  const artifactStats = await stat(artifact);

  if (!artifactStats.isFile()) {
    throw new Error(`${artifact} is not a file`);
  }

  if ((artifactStats.mode & 0o111) === 0) {
    throw new Error(`${basename(artifact)} is not executable; run chmod +x before smoke testing.`);
  }

  const workDir = await mkdtemp(join(tmpdir(), "hcb2-appimage-smoke-"));

  try {
    await extractAppImage(artifact, workDir);
    await verifyDesktopEntry(workDir);

    if (process.env.HCB_APPIMAGE_SMOKE_LAUNCH === "1") {
      await launchAppImage(artifact, workDir);
    } else {
      console.log("Skipped AppImage launch; set HCB_APPIMAGE_SMOKE_LAUNCH=1 to launch with isolated user data.");
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function latestAppImageNameHint(): string {
  return "Hot-Cross-Buns-2-linux-x64.AppImage";
}

function runCommand(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number }): Promise<{
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGTERM");
          rejectRun(new Error(`${basename(command)} timed out after ${options.timeoutMs}ms`));
        }, options.timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      rejectRun(error);
    });
    child.on("close", (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      const output = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      };

      if (code === 0) {
        resolveRun(output);
        return;
      }

      rejectRun(new Error(`${basename(command)} exited with ${code ?? "unknown"}: ${output.stderr || output.stdout}`));
    });
  });
}

async function extractAppImage(artifact: string, workDir: string): Promise<void> {
  await runCommand(artifact, ["--appimage-extract"], {
    cwd: workDir,
    timeoutMs: 60_000
  });
}

async function verifyDesktopEntry(workDir: string): Promise<void> {
  const desktopPath = join(workDir, "squashfs-root", "hot-cross-buns-2.desktop");
  const desktop = await readFile(desktopPath, "utf8");

  for (const [field, expected] of requiredDesktopFields) {
    const line = `${field}=${expected}`;

    if (!desktop.includes(line)) {
      throw new Error(`AppImage desktop metadata is missing ${line}`);
    }
  }

  if (desktop.includes("x-scheme-handler/hotcrossbuns")) {
    throw new Error("AppImage desktop metadata must not register hotcrossbuns:// while Linux deep links are explicitly unsupported.");
  }
}

async function launchAppImage(artifact: string, workDir: string): Promise<void> {
  const userDataDir = join(workDir, "user-data");
  const child = spawn(artifact, [], {
    cwd: workDir,
    detached: true,
    env: {
      ...process.env,
      HCB_USER_DATA_DIR: userDataDir,
      ELECTRON_ENABLE_LOGGING: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output: Buffer[] = [];

  child.stdout.on("data", (chunk) => output.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => output.push(Buffer.from(chunk)));

  await new Promise<void>((resolveLaunch, rejectLaunch) => {
    let forceKillTimeout: NodeJS.Timeout | null = null;
    let settled = false;
    const settle = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
      }
      resolveLaunch();
    };
    const stopApp = () => {
      signalAppImage(child.pid, "SIGTERM");
      forceKillTimeout = setTimeout(() => {
        signalAppImage(child.pid, "SIGKILL");
        child.stdout.destroy();
        child.stderr.destroy();
        settle();
      }, 1_500);
    };
    const timeout = setTimeout(stopApp, launchTimeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
      }
      rejectLaunch(error);
    });
    child.on("close", settle);
  });

  const logs = Buffer.concat(output).toString("utf8");

  if (!logs.trim()) {
    throw new Error("AppImage launch produced no startup logs.");
  }
}

function signalAppImage(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) {
    return;
  }

  try {
    process.kill(-pid, signal);
    return;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ESRCH") {
      try {
        process.kill(pid, signal);
      } catch (fallbackError) {
        if ((fallbackError as NodeJS.ErrnoException).code !== "ESRCH") {
          throw fallbackError;
        }
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
