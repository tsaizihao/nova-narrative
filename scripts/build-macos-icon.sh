#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ICON="$ROOT/src-tauri/icons/icon.png"
MACOS_ICON_ROUNDED_PNG="$ROOT/src-tauri/icons/icon-macos-rounded.png"

# Geometry constants ensure the icon is centered on a 1024x1024 canvas while keeping corners within the safe rounded area.
CANVAS_SIZE=1024
SAFE_ICON_SIZE=820
MASK_PADDING=64
MASK_END=$((CANVAS_SIZE - MASK_PADDING))
ROUND_RADIUS=224

TAURI_ICON_PARENT=""
cleanup() {
  if [[ -n "${TAURI_ICON_PARENT:-}" && -d "$TAURI_ICON_PARENT" ]]; then
    rm -rf "$TAURI_ICON_PARENT"
  fi
}
trap cleanup EXIT

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This macOS icon builder only runs on Darwin hosts." >&2
  exit 1
fi

if ! command -v magick >/dev/null; then
  echo "magick is required; please install ImageMagick." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null; then
  echo "pnpm is required to run the Tauri CLI." >&2
  exit 1
fi

if [[ ! -f "$SOURCE_ICON" ]]; then
  echo "Source icon not found at $SOURCE_ICON" >&2
  exit 1
fi

magick "$SOURCE_ICON" \
  -resize "${SAFE_ICON_SIZE}x${SAFE_ICON_SIZE}" \
  -gravity center \
  -background none \
  -extent "${CANVAS_SIZE}x${CANVAS_SIZE}" \
  \( -size "${CANVAS_SIZE}x${CANVAS_SIZE}" xc:none -fill white -draw "roundrectangle ${MASK_PADDING},${MASK_PADDING} ${MASK_END},${MASK_END} ${ROUND_RADIUS},${ROUND_RADIUS}" \) \
  -alpha set \
  -compose DstIn \
  -composite \
  "$MACOS_ICON_ROUNDED_PNG"

TAURI_ICON_PARENT="$(mktemp -d)"
pnpm --dir "$ROOT" tauri icon "$MACOS_ICON_ROUNDED_PNG" -o "$TAURI_ICON_PARENT"

TAURI_ICNS="$(find "$TAURI_ICON_PARENT" -name '*.icns' -type f -print -quit)"
if [[ -z "$TAURI_ICNS" ]]; then
  echo "Tauri did not generate an .icns file under $TAURI_ICON_PARENT" >&2
  exit 1
fi

cp "$TAURI_ICNS" "$ROOT/src-tauri/icons/icon.icns"

echo "Updated: $MACOS_ICON_ROUNDED_PNG"
echo "Updated: $ROOT/src-tauri/icons/icon.icns"
