import { createHash } from "node:crypto";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { smokeLinuxAppImageArtifact } from "./smoke-test-appimage";

const versionedAppImage = "Hot-Cross-Buns-2-5.0.0-linux-x86_64.AppImage";
const stableAppImage = "Hot-Cross-Buns-2-linux.AppImage";
const stableX64AppImage = "Hot-Cross-Buns-2-linux-x64.AppImage";

async function createReleaseDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "hcb2-appimage-smoke-"));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function appImageScript(desktopExtra = ""): string {
  return `#!/bin/sh
if [ "$1" = "--appimage-extract" ]; then
  mkdir -p squashfs-root
  cat > squashfs-root/hot-cross-buns-2.desktop <<'EOF'
Name=Hot Cross Buns 2
Type=Application
Terminal=false
Categories=Office;
GenericName=Planner
StartupWMClass=hot-cross-buns-2
${desktopExtra}EOF
  exit 0
fi
echo "Hot Cross Buns 2 startup"
`;
}

async function writeArtifact(releaseDir: string, name: string, content: string): Promise<string> {
  const filePath = join(releaseDir, name);
  const hash = sha256(content);

  await writeFile(filePath, content);
  await chmod(filePath, 0o755);
  await writeFile(`${filePath}.sha256`, `${hash}  ${basename(filePath)}\n`);

  return hash;
}

async function writeValidArtifacts(releaseDir: string, desktopExtra = ""): Promise<{
  stableHash: string;
  stableX64Hash: string;
  versionedHash: string;
}> {
  const versionedHash = await writeArtifact(releaseDir, versionedAppImage, appImageScript(desktopExtra));
  const stableHash = await writeArtifact(releaseDir, stableAppImage, appImageScript());
  const stableX64Hash = await writeArtifact(releaseDir, stableX64AppImage, appImageScript());

  await writeFile(
    join(releaseDir, "SHASUMS256.txt"),
    [
      `${versionedHash}  ${versionedAppImage}`,
      `${stableHash}  ${stableAppImage}`,
      `${stableX64Hash}  ${stableX64AppImage}`
    ].join("\n") + "\n"
  );

  return { stableHash, stableX64Hash, versionedHash };
}

describe("Linux AppImage smoke test", () => {
  it("verifies versioned and stable AppImage aliases with checksums and desktop metadata", async () => {
    const releaseDir = await createReleaseDir();

    await writeValidArtifacts(releaseDir);

    await expect(smokeLinuxAppImageArtifact({ releaseDir, minimumBytes: 1 })).resolves.toHaveLength(4);
  });

  it("fails when SHASUMS256.txt does not match an AppImage", async () => {
    const releaseDir = await createReleaseDir();
    const { stableHash, versionedHash } = await writeValidArtifacts(releaseDir);

    await writeFile(
      join(releaseDir, "SHASUMS256.txt"),
      [
        `${versionedHash}  ${versionedAppImage}`,
        `${stableHash}  ${stableAppImage}`,
        `${"0".repeat(64)}  ${stableX64AppImage}`
      ].join("\n") + "\n"
    );

    await expect(smokeLinuxAppImageArtifact({ releaseDir, minimumBytes: 1 })).rejects.toThrow(
      "SHASUMS256.txt hash does not match Hot-Cross-Buns-2-linux-x64.AppImage"
    );
  });

  it("fails if AppImage metadata registers the unsupported Linux protocol", async () => {
    const releaseDir = await createReleaseDir();

    await writeValidArtifacts(releaseDir, "MimeType=x-scheme-handler/hotcrossbuns;\n");

    await expect(smokeLinuxAppImageArtifact({ releaseDir, minimumBytes: 1 })).rejects.toThrow(
      "AppImage desktop metadata must not register hotcrossbuns://"
    );
  });
});
