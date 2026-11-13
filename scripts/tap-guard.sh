#!/usr/bin/env bash
# Opt-in integration: suppress the touchpad for a short window after typing.
#
# Why: touchpad firmware palm classification needs time (~40ms), so a brief
# palm tap right after a typing pause completes before the firmware flags it
# as a palm; it reaches libinput as a regular finger tap and can steal
# keyboard focus mid-typing. Native palm rejection still covers sustained
# presses (MT_TOOL_PALM); this daemon covers only that brief-tap window.
#
# Entirely user-level: no root, no system files. Installs the daemon to
# $XDG_DATA_HOME (default ~/.local/share) and a --user systemd unit.
#
# Requires read access to keyboard evdev nodes; on stock Fedora that means
# membership in the 'input' group (one-time `sudo usermod -aG input "$USER"`
# + log out/in). The script refuses to install without it.
#
# Hardware-validated on ASUS Zenbook A16 (Fedora, GNOME 51, Wayland) with a
# keyd-remapped external keyboard:
#   ./scripts/tap-guard.sh install   # user-level: daemon + --user service
#   ./scripts/tap-guard.sh status
#   ./scripts/tap-guard.sh remove
set -euo pipefail

SRC="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/integrations/tap-guard"
MARKER="managed by fedora-mac-like-config"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/fedora-mac-like-config/integrations/tap-guard"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
DAEMON_SRC="$SRC/fml-tap-guard"
UNIT_SRC="$SRC/fml-tap-guard.service"
DAEMON_DEST="$DATA_DIR/fml-tap-guard"
UNIT_NAME=fml-tap-guard.service
usage() {
  echo "Usage: $0 install | remove | status" >&2
  exit 2
}
[[ $# == 1 ]] || usage
case "$1" in
  install|remove|status) ;;
  *) usage ;;
esac

# Resolve the unit destination from the source name (portable above).
UNIT_DEST="$UNIT_DIR/$(basename "$UNIT_SRC")"

find_keyboard_node() { # first evdev node matching the daemon's default pattern
  local node name
  for node in /sys/class/input/event*; do
    name="$(cat "$node/device/name" 2>/dev/null || true)"
    if [[ "${name,,}" == *keyboard* ]]; then
      echo "/dev/input/$(basename "$node")"
      return 0
    fi
  done
  return 1
}

can_read_keyboard() {
  local node
  node="$(find_keyboard_node)" || return 1
  python3 - "$node" <<'PY'
import os, sys
try:
    fd = os.open(sys.argv[1], os.O_RDONLY | os.O_NONBLOCK)
    os.close(fd)
except PermissionError:
    sys.exit(1)
except OSError:
    sys.exit(0)  # exists but unreadable for another reason; let the service report it
sys.exit(0)
PY
}

if [[ "$1" == install ]]; then
  command -v systemctl >/dev/null || { echo "systemctl not found" >&2; exit 1; }
  # syntax-only check; must not write __pycache__ into the repo
  python3 -c "import sys; compile(open(sys.argv[1]).read(), sys.argv[1], 'exec')" "$DAEMON_SRC" \
    || { echo "daemon does not compile" >&2; exit 1; }
  if ! can_read_keyboard; then
    cat >&2 <<EOF
No readable keyboard evdev node found (looked for: $(find_keyboard_node || echo '<none>')).
On stock Fedora the desktop user is not in the 'input' group. One-time fix,
then log out and back in:
  sudo usermod -aG input "$USER"
EOF
    exit 1
  fi
  if [[ -e "$DAEMON_DEST" ]] && ! grep -q "$MARKER" "$DAEMON_DEST"; then
    echo "Refusing to overwrite unmanaged file: $DAEMON_DEST" >&2
    exit 1
  fi
  if [[ -e "$UNIT_DEST" ]] && ! grep -q "$MARKER" "$UNIT_DEST"; then
    echo "Refusing to overwrite unmanaged file: $UNIT_DEST" >&2
    exit 1
  fi
  mkdir -p "$DATA_DIR" "$UNIT_DIR"
  install -m 0755 "$DAEMON_SRC" "$DAEMON_DEST"
  install -m 0644 "$UNIT_SRC" "$UNIT_DEST"
  systemctl --user daemon-reload
  systemctl --user enable --now "$UNIT_NAME"
  sleep 1
  if systemctl --user is-active --quiet "$UNIT_NAME"; then
    echo "Installed and active: $UNIT_NAME"
    echo "  daemon: $DAEMON_DEST"
    echo "  unit:   $UNIT_DEST"
    echo "Tuning: create ~/.config/systemd/user/$UNIT_NAME.d/override.conf with an"
    echo "ExecStart override (--idle-secs=SECONDS, default 1.0), then 'systemctl --user daemon-reload && systemctl --user restart $UNIT_NAME'."
    echo "Check what it does: journalctl --user -u $UNIT_NAME -f"
  else
    echo "Installed but service is not active; see journalctl --user -u $UNIT_NAME" >&2
    exit 1
  fi
  exit 0
fi

if [[ "$1" == remove ]]; then
  if [[ -e "$DAEMON_DEST" ]] && ! grep -q "$MARKER" "$DAEMON_DEST"; then
    echo "Refusing to remove unmanaged file: $DAEMON_DEST" >&2
    exit 1
  fi
  if [[ -e "$UNIT_DEST" ]] && ! grep -q "$MARKER" "$UNIT_DEST"; then
    echo "Refusing to remove unmanaged file: $UNIT_DEST" >&2
    exit 1
  fi
  systemctl --user disable --now "$UNIT_NAME" 2>/dev/null || true
  [[ -e "$UNIT_DEST" ]] && rm -- "$UNIT_DEST"
  [[ -e "$DAEMON_DEST" ]] && rm -- "$DAEMON_DEST"
  rmdir --ignore-fail-on-non-empty -p "$DATA_DIR" 2>/dev/null || true
  systemctl --user daemon-reload
  echo "Removed managed files and disabled the service (if present). The touchpad is live again immediately."
  exit 0
fi

# status (read-only)
echo "== fedora-mac-like tap-guard status =="
if systemctl --user is-enabled --quiet "$UNIT_NAME" 2>/dev/null; then
  echo "service: enabled / $(systemctl --user is-active "$UNIT_NAME")"
else
  echo "service: not installed (or disabled)"
fi
if [[ -e "$DAEMON_DEST" ]]; then
  echo "daemon: $DAEMON_DEST"
else
  echo "daemon: not installed"
fi
if command -v gsettings >/dev/null; then
  echo "touchpad send-events now: $(gsettings get org.gnome.desktop.peripherals.touchpad send-events 2>/dev/null || echo unknown)"
fi
if [[ -e "$DAEMON_DEST" ]]; then
  "$DAEMON_DEST" --list-devices 2>/dev/null | sed 's/^/  watching: /' || true
fi
echo "Hint: sustained palm presses are rejected natively (MT_TOOL_PALM); this daemon only covers brief taps within its idle window after typing."
