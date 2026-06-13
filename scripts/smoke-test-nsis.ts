import { stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const DEFAULT_RELEASE_DIR = "release";
const stableInstallerName = "Hot-Cross-Buns-2-windows-x64.exe";
const minimumInstallerBytes = 20 * 1024 * 1024;

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
  const artifact = resolve(argValue("--artifact", join(releaseDir, stableInstallerName)));
  const artifactStats = await stat(artifact);

  if (!artifactStats.isFile()) {
    throw new Error(`${artifact} is not a file`);
  }

  if (artifactStats.size < minimumInstallerBytes) {
    throw new Error(`${basename(artifact)} is unexpectedly small for a Windows NSIS installer.`);
  }

  console.log(`${basename(artifact)} exists and is ${artifactStats.size} bytes.`);
  console.log("Windows install, launch, protocol, notification, and uninstall behavior still require Windows manual QA.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
