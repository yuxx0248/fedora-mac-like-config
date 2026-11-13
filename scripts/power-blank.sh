#!/usr/bin/env bash
# Opt-in integration: power button short press = screen blank (no suspend, no
# lock), keyboard backlight off while blanked. Installs two narrowly scoped
# user services; never touched by the default installer.
#
# Hardware-validated on ASUS Zenbook A16 (Fedora, GNOME 51, Wayland):
#   ./scripts/power-blank.sh install        # user daemons, no root
#   ./scripts/power-blank.sh install-logind # optional root drop-in
#   ./scripts/power-blank.sh status
#   ./scripts/power-blank.sh remove [remove-logind]
set -euo pipefail

SRC="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/integrations/power-blank"
BIN_DIR="$HOME/.local/bin"
UNIT_DIR="$HOME/.config/systemd/user"
MARKER="managed by fedora-mac-like-config"
DROPIN=/etc/systemd/logind.conf.d/91-fedora-mac-like-power-blank.conf
SCHEMA=org.gnome.settings-daemon.plugins.power
KEY=power-button-action
LEDBIN=/sys/class/leds/asus::kbd_backlight/brightness
PAYLOADS=(
  "fml-power-blank:bin"
  "fml-kbd-backlight-watcher:bin"
  "fml-power-blank.service:unit"
  "fml-kbd-backlight-watcher.service:unit"
)
usage() {
  echo "Usage: $0 install | remove | status | install-logind | remove-logind" >&2
  exit 2
}
[[ $# -ge 1 ]] || usage
case "$1" in
  install|remove|status|install-logind|remove-logind) [[ $# == 1 ]] || usage ;;
  *) usage ;;
esac

dest_of() { # payload -> destination path
  local name="${1%%:*}" kind="${1##*:}"
  if [[ "$kind" == bin ]]; then echo "$BIN_DIR/$name"; else echo "$UNIT_DIR/$name"; fi
}

install_payload() {
  local payload="$1" dest
  dest="$(dest_of "$payload")"
  if [[ -e "$dest" ]] && ! grep -q "$MARKER" "$dest"; then
    echo "Refusing to overwrite unmanaged file: $dest" >&2
    exit 1
  fi
  mkdir -p "$(dirname -- "$dest")"
  install -m 0755 "$SRC/${payload%%:*}" "$dest"
}

if [[ "$1" == install ]]; then
  if (( EUID == 0 )); then
    echo "Do not run the user integration with sudo/root" >&2
    exit 1
  fi
  for tool in python3 systemctl gdbus gsettings; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "Required executable missing: $tool" >&2
      exit 1
    fi
  done
  action="$(gsettings get "$SCHEMA" "$KEY" 2>/dev/null || true)"
  if [[ "$action" != "'nothing'" ]]; then
    echo "GNOME power-button-action is ${action:-unset}; this integration needs 'nothing' so GNOME does not suspend on the same press." >&2
    echo "Run first:  ./install.sh --module power-nothing" >&2
    exit 1
  fi
  for payload in "${PAYLOADS[@]}"; do install_payload "$payload"; done
  systemctl --user daemon-reload
  systemctl --user enable --now fml-power-blank.service fml-kbd-backlight-watcher.service
  echo "Installed user services (fml-power-blank, fml-kbd-backlight-watcher)."
  echo "Short press should now blank the screen; test on real hardware before relying on it."
  echo "Keyboard LED restore needs passwordless sudo for 'sudo -n tee $LEDBIN'; without it the LED part is a no-op. See docs/power.md."
  echo "Optional logind fallback (greeter/non-GNOME sessions): $0 install-logind"
  exit 0
fi

if [[ "$1" == install-logind ]]; then
  if (( EUID != 0 )); then
    exec sudo -- "$0" "$@"
  fi
  if [[ -e "$DROPIN" ]] && ! grep -q "$MARKER" "$DROPIN"; then
    echo "Refusing to overwrite unmanaged file: $DROPIN" >&2
    exit 1
  fi
  install -d -m 0755 /etc/systemd/logind.conf.d
  tmp="$(mktemp)"
  trap 'rm -f -- "$tmp"' EXIT
  printf '%s\n[Login]\nHandlePowerKey=ignore\nHandlePowerKeyLongPress=suspend\n' \
    "# $MARKER (scripts/power-blank.sh; short press is handled in the user session)" > "$tmp"
  install -m 0644 "$tmp" "$DROPIN"
  echo "Wrote $DROPIN (HandlePowerKey=ignore, HandlePowerKeyLongPress=suspend)."
  echo "No services restarted; reboot or reload logind to apply. Later-lexical drop-ins may override this one; check 'systemd-analyze cat-config systemd/logind.conf'."
  exit 0
fi

if [[ "$1" == remove-logind ]]; then
  if (( EUID != 0 )); then
    exec sudo -- "$0" "$@"
  fi
  if [[ -e "$DROPIN" ]] && ! grep -q "$MARKER" "$DROPIN"; then
    echo "Refusing to remove unmanaged file: $DROPIN" >&2
    exit 1
  fi
  if [[ -e "$DROPIN" ]]; then rm -- "$DROPIN"; fi
  echo "Removed managed drop-in (if present). Reboot or reload logind before checking behavior."
  exit 0
fi

if [[ "$1" == remove ]]; then
  if (( EUID == 0 )); then
    echo "Do not run the user integration with sudo/root" >&2
    exit 1
  fi
  systemctl --user disable --now fml-power-blank.service fml-kbd-backlight-watcher.service 2>/dev/null || true
  for payload in "${PAYLOADS[@]}"; do
    dest="$(dest_of "$payload")"
    if [[ -e "$dest" ]] && ! grep -q "$MARKER" "$dest"; then
      echo "Keeping unmanaged file: $dest" >&2
    else
      rm -f -- "$dest"
    fi
  done
  systemctl --user daemon-reload
  echo "Removed user services (logind drop-in, if installed, needs: $0 remove-logind)."
  exit 0
fi

# status (read-only)
echo "== fedora-mac-like power-blank status =="
echo "GNOME $SCHEMA $KEY: $(gsettings get "$SCHEMA" "$KEY" 2>/dev/null || echo unavailable)"
for payload in "${PAYLOADS[@]}"; do
  dest="$(dest_of "$payload")"
  if [[ -e "$dest" ]]; then
    managed="unmanaged"; grep -q "$MARKER" "$dest" && managed="managed"
    echo "INSTALLED ($managed): $dest"
  else
    echo "MISSING: $dest"
  fi
done
for unit in fml-power-blank.service fml-kbd-backlight-watcher.service; do
  echo "unit $unit: $(systemctl --user is-active "$unit" 2>/dev/null || echo unavailable)"
done
if [[ -e "$DROPIN" ]]; then
  echo "logind drop-in: $DROPIN"
  sed -n '1,6p' "$DROPIN"
else
  echo "logind drop-in: not installed"
fi
if [[ -e /sys/class/leds/asus::kbd_backlight/brightness ]]; then
  echo "keyboard LED file present, brightness: $(cat /sys/class/leds/asus::kbd_backlight/brightness 2>/dev/null || echo unreadable)"
else
  echo "keyboard LED file: not found on this hardware"
fi
echo "Hint: sudo -n must allow '/usr/bin/tee <led>/brightness' for the LED part; check 'loginctl list-inhibitors' for power-key owners."
