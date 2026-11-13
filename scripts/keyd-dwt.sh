#!/usr/bin/env bash
# Opt-in integration: make libinput's disable-while-typing (DWT) apply to keyd
# virtual keyboards. Typing through keyd otherwise leaves the touchpad live,
# so palm contact while typing moves the pointer. Installs one narrowly named
# udev rule; never touched by the default installer.
#
# Hardware-validated on ASUS Zenbook A16 (Fedora, GNOME 51, Wayland):
#   ./scripts/keyd-dwt.sh install        # root: udev rule + udevadm reload/trigger
#   ./scripts/keyd-dwt.sh status
#   ./scripts/keyd-dwt.sh remove
set -euo pipefail

SRC="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/integrations/keyd-dwt"
RULE_NAME=99-keyd-internal-keyboard.rules
DEST=/etc/udev/rules.d/$RULE_NAME
MARKER="managed by fedora-mac-like-config"
usage() {
  echo "Usage: $0 install | remove | status" >&2
  exit 2
}
[[ $# == 1 ]] || usage
case "$1" in
  install|remove|status) ;;
  *) usage ;;
esac

matched_devices() { # udev input devices currently carrying the integration attr
  local dev props
  for dev in /dev/input/event*; do
    props="$(udevadm info -q property "$dev" 2>/dev/null || true)"
    if grep -q '^LIBINPUT_ATTR_KEYBOARD_INTEGRATION=internal$' <<<"$props"; then
      echo "$dev"
    fi
  done
}

if [[ "$1" == install ]]; then
  if (( EUID != 0 )); then
    exec sudo -- "$0" "$@"
  fi
  if [[ -e "$DEST" ]] && ! grep -q "$MARKER" "$DEST"; then
    echo "Refusing to overwrite unmanaged file: $DEST" >&2
    exit 1
  fi
  install -m 0644 "$SRC/$RULE_NAME" "$DEST"
  udevadm control --reload
  udevadm trigger --subsystem-match=input
  echo "Wrote $DEST and reprocessed input devices."
  count=0
  while IFS= read -r dev; do
    echo "  marked internal: $dev"
    count=$((count + 1))
  done < <(matched_devices)
  if (( count == 0 )); then
    echo "No device carries the attribute; is keyd running? The rule stays installed and will match once its device appears." >&2
  fi
  echo "No services restarted. A GNOME Wayland session started before this rule only reads the attribute at login: log out and back in for DWT to take effect."
  exit 0
fi

if [[ "$1" == remove ]]; then
  if (( EUID != 0 )); then
    exec sudo -- "$0" "$@"
  fi
  if [[ -e "$DEST" ]] && ! grep -q "$MARKER" "$DEST"; then
    echo "Refusing to remove unmanaged file: $DEST" >&2
    exit 1
  fi
  if [[ -e "$DEST" ]]; then rm -- "$DEST"; fi
  udevadm control --reload
  echo "Removed managed rule (if present). A running session keeps its current DWT behavior until log out/in."
  exit 0
fi

# status (read-only)
echo "== fedora-mac-like keyd-dwt status =="
if [[ -e "$DEST" ]]; then
  managed="unmanaged"; grep -q "$MARKER" "$DEST" && managed="managed"
  echo "INSTALLED ($managed): $DEST"
else
  echo "MISSING: $DEST"
fi
count=0
while IFS= read -r dev; do
  echo "  marked internal: $dev"
  count=$((count + 1))
done < <(matched_devices)
echo "devices marked internal: $count"
echo "Hint: verify DWT end to end with 'sudo libinput list-devices' (touchpad 'Disable-w-typing') and, after log out/in, that no pointer motion lands within ~0.5s of keystrokes (sudo libinput debug-events)."
