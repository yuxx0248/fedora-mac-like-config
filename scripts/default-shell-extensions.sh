#!/usr/bin/env bash
# Install only the project's bundled, current-user GNOME Shell 51 extensions.
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
if ! command -v gnome-extensions >/dev/null || ! command -v gnome-shell >/dev/null || ! command -v gjs >/dev/null; then
    printf 'SKIP bundled extensions: GNOME Shell tools unavailable.\n'
    exit 0
fi
case "$(gnome-shell --version)" in
    'GNOME Shell 51.'*) ;;
    *) printf 'SKIP bundled extensions: these integrations target GNOME Shell 51 only.\n'; exit 0 ;;
esac
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"
dry_run=false
case "${1:-}" in
    '') ;;
    --dry-run) dry_run=true ;;
    *) printf 'Usage: %s [--dry-run]\n' "$0" >&2; exit 2 ;;
esac
if ! "$dry_run"; then
    package_dir=$(mktemp -d)
    trap 'rm -rf -- "$package_dir"' EXIT
fi
for name in fullscreen-top-bar fullscreen-workspace overview-workspace-size; do
    uuid="$name@fedora-mac-like-config"
    if [ -e "$extension_dir/$uuid" ] || gnome-extensions info "$uuid" >/dev/null 2>&1; then
        printf 'PRESERVED existing extension %s\n' "$uuid"
        continue
    fi
    # Respect an explicit disabled entry, even if its files are currently absent.
    if ! gjs -c "const Gio=imports.gi.Gio; const s=new Gio.Settings({schema_id:'org.gnome.shell'}); if (s.get_strv('disabled-extensions').includes(ARGV[0])) imports.system.exit(1);" "$uuid"; then
        printf 'PRESERVED disabled extension %s\n' "$uuid"
        continue
    fi
    if "$dry_run"; then
        printf 'WOULD INSTALL %s\n' "$uuid"
        continue
    fi
    gnome-extensions pack "$ROOT/integrations/$name/$uuid" --out-dir "$package_dir"
    gnome-extensions install "$package_dir/$uuid.shell-extension.zip"
    gjs -c "const Gio=imports.gi.Gio; const s=new Gio.Settings({schema_id:'org.gnome.shell'}); const id=ARGV[0]; const enabled=s.get_strv('enabled-extensions'); if (!enabled.includes(id)) { enabled.push(id); if (!s.set_strv('enabled-extensions', enabled)) throw Error('Failed to enable '+id); }" "$uuid"
    printf 'INSTALLED %s (manual re-login may be required)\n' "$uuid"
done
