#!/usr/bin/env bash
# Opt-in integration: macOS-style bottom-row modifier layout for keyboards whose
# firmware/driver already emits the expected evdev keycodes, plus the dual-role
# physical-Ctrl chord, via one udev hwdb file and one keyd config. Installs two
# narrowly named root files; never touched by the default installer.
#
# Hardware-validated on ASUS Zenbook A16 (keyboard 0B05:4B42, Fedora 45,
# GNOME 51, Wayland, keyd 2.6.0), 2026-11-16:
#   ./scripts/mac-kbd-layout.sh install   # root: hwdb + keyd config
#   ./scripts/mac-kbd-layout.sh status
#   ./scripts/mac-kbd-layout.sh remove
#
# Resulting layout (see docs/keymap.md for rationale and pairing):
#   physical left Ctrl  tap -> Super (Overview); held -> Ctrl chords, with
#                           Ctrl+C delivered as Ctrl+Shift+C so VTE sees a
#                           real SIGINT while GNOME Terminal's copy binding
#                           (<Control>c) keeps physical Alt+C as "copy"
#   physical left Alt   -> Ctrl   (mac Command position; screenshot chords)
#   physical left Win   -> Alt    (Option position)
#   physical Fn         -> unchanged (consumed by EC firmware)
# Requires keyd (0B05:4B42 [ids] section assumes the Zenbook A16 keyboard).
set -euo pipefail

SRC="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/integrations/mac-kbd-layout"
MARKER='# managed by fedora-mac-like-config'
# payload basename : installed destination
FILES=(
  "main.conf:/etc/keyd/main.conf"
  "90-mac-style-kbd.hwdb:/etc/udev/hwdb.d/90-mac-style-kbd.hwdb"
)
usage() {
  echo "Usage: $0 install | remove | status" >&2
  exit 2
}
[[ $# == 1 ]] || usage
case "$1" in
  install|remove|status) ;;
  *) usage ;;
esac

# content identity ignoring the management marker, so installing over a
# hand-maintained identical file is an idempotent no-op, not a refusal
normalized() { grep -v "^${MARKER}\$" "$1" 2>/dev/null || true; }

is_managed() { grep -q "^${MARKER}\$" "$1" 2>/dev/null; }

same_content() { diff -q <(normalized "$1") <(normalized "$2") >/dev/null; }

if [[ "$1" == install ]]; then
  if (( EUID != 0 )); then exec sudo -- "$0" "$@"; fi
  for entry in "${FILES[@]}"; do
    payload="${entry%%:*}"; dest="${entry##*:}"
    if [[ -e "$dest" ]]; then
      if same_content "$SRC/$payload" "$dest"; then
        echo "already installed (idempotent no-op): $dest"
        continue
      fi
      if ! is_managed "$dest"; then
        echo "Refusing to overwrite unmanaged file: $dest" >&2
        echo "Review it, merge by hand, or move it aside first." >&2
        exit 1
      fi
    fi
    install -m 0644 "$SRC/$payload" "$dest"
    echo "wrote $dest"
  done
  systemd-hwdb update
  udevadm trigger --subsystem-match=input
  echo "Reprocessed input devices and rebuilt the hwdb binary database."
  echo "NOTE: on this hardware an already-open keyboard device kept its old keymap until reboot; if physical Alt does not emit Ctrl after install, reboot once."
  if command -v keyd >/dev/null 2>&1 && pgrep -x keyd >/dev/null 2>&1; then
    echo "keyd is running. Apply the new config explicitly with:"
    echo "  sudo keyd reload"
  else
    echo "keyd not detected; the keyd config takes effect once keyd runs with it."
  fi
  echo "Pairing reminder: the screenshot chords in modules/screenshot.json assume this layout (physical Alt = Ctrl)."
  exit 0
fi

if [[ "$1" == remove ]]; then
  if (( EUID != 0 )); then exec sudo -- "$0" "$@"; fi
  rc=0
  for entry in "${FILES[@]}"; do
    payload="${entry%%:*}"; dest="${entry##*:}"
    [[ -e "$dest" ]] || { echo "MISSING (nothing to remove): $dest"; continue; }
    if ! is_managed "$dest" && ! same_content "$SRC/$payload" "$dest"; then
      echo "Refusing to remove unmanaged file: $dest" >&2
      rc=1
      continue
    fi
    rm -- "$dest"
    echo "removed $dest"
  done
  systemd-hwdb update
  udevadm trigger --subsystem-match=input
  echo "hwdb rebuilt. A running session keeps the old keymap/keyd behavior until keyd is reloaded and, for the hwdb keymap, until reboot:"
  echo "  sudo keyd reload   # only if keyd is running"
  exit "$rc"
fi

# status (read-only)
echo "== fedora-mac-like mac-kbd-layout status =="
rc=0
for entry in "${FILES[@]}"; do
  payload="${entry%%:*}"; dest="${entry##*:}"
  if [[ -e "$dest" ]]; then
    if same_content "$SRC/$payload" "$dest"; then
      echo "INSTALLED (matches repo payload): $dest"
    elif is_managed "$dest"; then
      echo "INSTALLED (managed, locally modified): $dest"
      rc=1
    else
      echo "PRESENT (unmanaged, differs from payload): $dest"
      rc=1
    fi
  else
    echo "MISSING: $dest"
    rc=1
  fi
done
echo "keyd service: enabled=$(systemctl is-enabled keyd 2>/dev/null || echo unknown) active=$(systemctl is-active keyd 2>/dev/null || echo unknown)"
echo "Pairing reminder: screenshot chords (modules/screenshot.json) assume physical Alt = Ctrl from this layout."
exit "$rc"
