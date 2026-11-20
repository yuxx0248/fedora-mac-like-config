# Architecture

**Scope**: Fedora Workstation, GNOME on Wayland, logged-in user only.

1. `profiles/*.json` declares ordered module names.
2. `modules/*.json` contains atomic, declarative GNOME `schema/key/GVariant value` settings. These are project-owned manifests, **not an upstream GNOME standard**.
3. `src/fedora_mac_like/cli.py` checks actual GNOME schemas/keys at runtime via `gsettings get`, checks explicit user overrides via `dconf read`, previews changes, snapshots keys, then applies them via `gsettings set`. Unsupported keys are reported/skipped, exit status 2.
4. Rollback restores only the changed keys; it uses `gsettings reset` when the original value was inherited, or `gsettings set` for explicit overrides. It will not overwrite later edits without `--force`.
5. `scripts/power-system.sh` manages a narrowly named systemd-logind drop-in by explicit operator choice. Never run this from the default installer.
6. `scripts/power-blank.sh` is a separately documented opt-in integration: it installs two narrowly scoped **user** services (power-key short press -> screen blank, keyboard backlight watcher) plus an optional logind drop-in. It requires GNOME `power-button-action='nothing'`, and is not part of any profile.

GNOME shell Wayland owns multitouch swipe recognition: user GSettings can configure tapping/scrolling but cannot promise arbitrary 3/4-finger gesture replacements. Keyboard layout XKB is distinct from app-specific key semantics. The default install ships no separate background daemon; see the opt-in `power-blank` integration in `docs/power.md`. The default installer installs the bundled fullscreen top bar and workspace isolation extensions on GNOME Shell 51 without replacing existing extension files; see `docs/fullscreen-top-bar.md` and `docs/fullscreen-workspace.md`.

The default profile enables GNOME dynamic workspaces; the `dynamic-workspaces` profile applies only that setting without changing shortcuts. Its setting is handled by the normal preserve-and-rollback mechanism.

Workspace thumbnail reordering is a separate opt-in GNOME Shell extension; see `docs/workspace-reorder.md`.

Larger workspace thumbnails in Overview are a bundled GNOME Shell 51 extension installed by default; see `docs/overview-workspace-size.md`.

## Adding a module

Create `modules/your-module.json`, with `description` and nonempty `settings`. Each setting needs `schema`, `key`, `value`. Values are GVariant string literals as accepted by `gsettings set` (e.g. `true`, `'fingers'`, `['<Control><Super>Left']`). Add the module name to a profile only after a compatibility review and real hardware testing.

If a change needs root, third-party extensions, udev rules, kernel patches, or a custom daemon, **do not** sneak it into `modules/`; document a separate reviewed opt-in integration.
