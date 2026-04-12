# macOS Icon Mask Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild only the macOS `icon.icns` from the existing book artwork so the Dock/Finder icon uses a rounded-rectangle mask with transparent safety padding, while every non-macOS icon asset stays unchanged.

**Architecture:** Add one reproducible shell script that derives a macOS-only masked PNG from the current square source artwork, then converts that PNG into an `.icns` bundle via a temporary `.iconset` directory. Wire the script into `package.json` so future icon refreshes do not require manually re-running ad hoc image commands.

**Tech Stack:** Tauri 2, pnpm, macOS `iconutil`, ImageMagick (`magick`), shell script

---

## File Structure

- Modify: `package.json`
  Responsibility: expose a repeatable `pnpm` command for rebuilding the macOS icon asset.
- Create: `scripts/build-macos-icon.sh`
  Responsibility: generate the macOS-only rounded PNG, assemble a temporary `.iconset`, and write `src-tauri/icons/icon.icns`.
- Create: `src-tauri/icons/icon-macos-rounded.png`
  Responsibility: checked-in intermediate source used only for the macOS icon pipeline.
- Modify: `src-tauri/icons/icon.icns`
  Responsibility: macOS application icon consumed by Tauri bundling.

### Task 1: Add A Reproducible macOS Icon Build Command

**Files:**
- Modify: `package.json`
- Create: `scripts/build-macos-icon.sh`

- [ ] **Step 1: Verify the dedicated macOS icon pipeline does not exist yet**

Run: `test -f scripts/build-macos-icon.sh`
Expected: exit code `1`

Run: `node -e "const pkg=require('./package.json'); process.exit(pkg.scripts['icon:macos'] ? 0 : 1)"`
Expected: exit code `1`

- [ ] **Step 2: Add the `icon:macos` package script**

Update `package.json` so the scripts section includes:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "svelte-kit sync && vitest run",
    "tauri": "tauri",
    "icon:macos": "bash ./scripts/build-macos-icon.sh"
  }
}
```

- [ ] **Step 3: Create the macOS icon build script**

Create `scripts/build-macos-icon.sh` with:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ICON="$ROOT/src-tauri/icons/icon.png"
MACOS_ICON_SOURCE="$ROOT/src-tauri/icons/icon-macos-rounded.png"
ICONSET_DIR="$(mktemp -d "${TMPDIR:-/tmp}/nova-macos-iconset.XXXXXX")"

cleanup() {
  rm -rf "$ICONSET_DIR"
}

trap cleanup EXIT

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick 'magick' is required" >&2
  exit 1
fi

if ! command -v iconutil >/dev/null 2>&1; then
  echo "macOS 'iconutil' is required" >&2
  exit 1
fi

if [ ! -f "$SOURCE_ICON" ]; then
  echo "Missing source icon: $SOURCE_ICON" >&2
  exit 1
fi

# Preserve the full artwork, shrink it slightly, and mask it into a macOS-like rounded tile.
magick "$SOURCE_ICON" \
  -resize 820x820 \
  -background none \
  -gravity center \
  -extent 1024x1024 \
  \( -size 1024x1024 xc:black -fill white -draw "roundrectangle 64,64 960,960 224,224" \) \
  -alpha off \
  -compose CopyOpacity \
  -composite \
  "$MACOS_ICON_SOURCE"

for size in 16 32 128 256 512; do
  double_size=$((size * 2))
  magick "$MACOS_ICON_SOURCE" -resize "${size}x${size}" "$ICONSET_DIR/icon_${size}x${size}.png"
  magick "$MACOS_ICON_SOURCE" -resize "${double_size}x${double_size}" "$ICONSET_DIR/icon_${size}x${size}@2x.png"
done

iconutil --convert icns --output "$ROOT/src-tauri/icons/icon.icns" "$ICONSET_DIR"

echo "Updated:"
echo "  $MACOS_ICON_SOURCE"
echo "  $ROOT/src-tauri/icons/icon.icns"
```

- [ ] **Step 4: Make the script executable and verify the command is wired up**

Run: `chmod +x scripts/build-macos-icon.sh`

Run: `node -e "const pkg=require('./package.json'); console.log(pkg.scripts['icon:macos'])"`
Expected output: `bash ./scripts/build-macos-icon.sh`

Run: `bash -n scripts/build-macos-icon.sh`
Expected: no output, exit code `0`

- [ ] **Step 5: Commit the pipeline setup**

Run:

```bash
git add package.json scripts/build-macos-icon.sh
git commit -m "build: add reproducible macos icon pipeline"
```

### Task 2: Generate The Rounded macOS Icon Assets

**Files:**
- Create: `src-tauri/icons/icon-macos-rounded.png`
- Modify: `src-tauri/icons/icon.icns`

- [ ] **Step 1: Verify the new macOS-only source asset is absent before generation**

Run: `test -f src-tauri/icons/icon-macos-rounded.png`
Expected: exit code `1`

- [ ] **Step 2: Run the dedicated macOS icon build**

Run: `pnpm run icon:macos`
Expected output:

```text
Updated:
  /.../src-tauri/icons/icon-macos-rounded.png
  /.../src-tauri/icons/icon.icns
```

- [ ] **Step 3: Verify the generated PNG has the expected size and transparency**

Run: `sips -g pixelWidth -g pixelHeight -g hasAlpha src-tauri/icons/icon-macos-rounded.png`
Expected output contains:

```text
pixelWidth: 1024
pixelHeight: 1024
hasAlpha: yes
```

Run: `magick identify -format '%[pixel:p{0,0}]' src-tauri/icons/icon-macos-rounded.png`
Expected output starts with `srgba(0,0,0,0)` or another fully transparent pixel value

- [ ] **Step 4: Verify the `.icns` file was regenerated recently**

Run: `ls -lT src-tauri/icons/icon.icns`
Expected: modification time matches the current run

- [ ] **Step 5: Commit the macOS icon assets**

Run:

```bash
git add src-tauri/icons/icon-macos-rounded.png src-tauri/icons/icon.icns
git commit -m "feat: round macos app icon"
```

### Task 3: Verify Build Integration And macOS Appearance

**Files:**
- Modify: `src-tauri/icons/icon.icns`
- Test: `src-tauri/icons/icon-macos-rounded.png`

- [ ] **Step 1: Run the Tauri build to prove the new `.icns` integrates cleanly**

Run: `pnpm tauri build --debug --no-bundle`
Expected output contains:

```text
Finished `dev` profile [unoptimized + debuginfo] target(s) in
Built application at:
```

- [ ] **Step 2: Inspect the generated macOS icon preview**

Run: `qlmanage -p src-tauri/icons/icon.icns`
Expected: Quick Look shows a rounded-rectangle icon with visible transparent outer padding and the full book artwork preserved inside the mask

- [ ] **Step 3: Relaunch the app and confirm Dock/Finder behavior**

Run: `pnpm tauri dev`
Expected: the running app shows the rounded-rectangle icon in the Dock instead of the previous square-cropped appearance

- [ ] **Step 4: If the Dock still caches the old icon, clear the app process and relaunch once**

Run: `killall nova-narrative || true`

Run: `pnpm tauri dev`
Expected: the relaunched app shows the updated icon

- [ ] **Step 5: Commit the final verified state**

Run:

```bash
git add package.json scripts/build-macos-icon.sh src-tauri/icons/icon-macos-rounded.png src-tauri/icons/icon.icns
git commit -m "feat: apply macos rounded app icon"
```

## Self-Review

- Spec coverage: the plan covers the macOS-only scope, preserves the full artwork, adds transparent safety padding, and leaves all non-macOS icon files untouched.
- Placeholder scan: no red-flag placeholder language remains.
- Type consistency: the same file names and command names are used throughout: `scripts/build-macos-icon.sh`, `icon:macos`, `src-tauri/icons/icon-macos-rounded.png`, and `src-tauri/icons/icon.icns`.
