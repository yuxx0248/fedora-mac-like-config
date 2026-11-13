#!/usr/bin/env bash
# Explicit privileged fallback policy; GNOME can take precedence via inhibitors.
set -euo pipefail
DEST=/etc/systemd/logind.conf.d/90-fedora-mac-like-power.conf
MARKER='# managed by fedora-mac-like-config'
usage() {
  echo "Usage: $0 set {lock|suspend|ignore|poweroff} | remove" >&2
  exit 2
}
[[ $# -ge 1 ]] || usage
case "$1" in
  set) [[ $# == 2 ]] || usage
       case "$2" in lock|suspend|ignore|poweroff) ;; *) usage ;; esac ;;
  remove) [[ $# == 1 ]] || usage ;;
  *) usage ;;
esac
if (( EUID != 0 )); then
  exec sudo -- "$0" "$@"
fi
if [[ -e "$DEST" ]] && ! grep -Fxq "$MARKER" "$DEST"; then
  echo "Refusing to overwrite unmanaged file: $DEST" >&2
  exit 1
fi
if [[ "$1" == remove ]]; then
  if [[ -e "$DEST" ]]; then rm -- "$DEST"; fi
  echo "Removed managed drop-in (if present). Reboot before checking behavior."
  exit 0
fi
install -d -m 0755 /etc/systemd/logind.conf.d
tmp="$(mktemp)"
trap 'rm -f -- "$tmp"' EXIT
printf '%s\n[Login]\nHandlePowerKey=%s\n' "$MARKER" "$2" > "$tmp"
install -m 0644 "$tmp" "$DEST"
echo "Wrote $DEST. No services restarted. Reboot and test; GNOME inhibitors may make it ineffective."
