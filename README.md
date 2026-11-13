# Fedora macOS-like Config

Reversible macOS-inspired interaction settings for **Fedora Workstation + GNOME + Wayland**. No custom kernel, GNOME Shell fork, or desktop replacement.

This project manages **interaction**, not wallpapers, boot art, GTK themes, or kernel patches. It uses native GSettings/dconf keys and keeps system power policy separate.

## Install

On a Fedora Workstation GNOME terminal:

```bash
git clone https://github.com/yuxx0248/fedora-mac-like-config.git
cd fedora-mac-like-config
./install.sh
```

The default profile applies touchpad settings, workspace shortcuts, and macOS-style left-side titlebar buttons. **Existing explicit user settings are preserved by default.** Every changed key is backed up first.

```bash
./install.sh --dry-run                  # preview without changing anything
./install.sh --profile minimal          # touchpad only
./install.sh --force                    # explicitly override existing customizations
./install.sh --power interactive        # opt-in power-button dialog
./install.sh --power suspend            # opt-in suspend; test hardware first!
./install.sh --power nothing            # opt-in ignore short press
./install.sh --module caps-escape       # optional CapsLock -> Escape
./install.sh --profile default --dry-run --power suspend
```

To inspect and restore:

```bash
python3 src/fedora_mac_like/cli.py doctor
python3 src/fedora_mac_like/cli.py status
python3 src/fedora_mac_like/cli.py rollback            # undo most recent changed keys
python3 src/fedora_mac_like/cli.py rollback --force    # undo even if edited since install
python3 src/fedora_mac_like/cli.py validate            # validate manifests
```

Backups are under `$XDG_STATE_HOME/fedora-mac-like-config/backups/` or `~/.local/state/fedora-mac-like-config/backups/`.

## What's included?

| Area | Default behavior | Managed by |
| --- | --- | --- |
| Touchpad | Tap to click, natural scrolling, two-finger scroll, two-finger secondary click | GNOME GSettings |
| Gestures | GNOME native three-finger workspaces / overview gestures | GNOME/Wayland (no override needed) |
| Workspaces | Ctrl+Super+Left/Right to switch, +Shift to move window | GNOME WM shortcuts |
| Window buttons | Close/minimize/maximize on left | GNOME WM preferences |
| Power button | **Unchanged unless `--power` is given** | GNOME GSettings |
| Caps Lock | **Unchanged unless `--module caps-escape` is given** | GNOME input sources |

GNOME's `Super` key is the closest counterpart to macOS Command for desktop shortcuts, but **Cmd+C/V and other app-local editing shortcuts are not automatically changed**: Linux applications generally use Ctrl. True per-application Command remapping requires a separate, opt-in remapper with a tested hardware/Wayland policy; see `docs/keymap.md`.

Some touch gestures are owned by the compositor and **cannot be redefined by GSettings**. GNOME's native ones are used instead of promising unsupported custom swipes.

## Power key: read this first

```bash
./install.sh --power interactive
# OR, after checking suspend/resume on your laptop:
./install.sh --power suspend
```

Power-key handling is layered: GNOME may take a `handle-power-key` low-level inhibitor; systemd-logind only handles the key when no such inhibitor is held. `HandlePowerKey=` does **not** reliably override an active GNOME session. See [docs/power.md](docs/power.md) for both routes, caveats, diagnostics, and the explicit system-level helper.

`interactive` is a power-off dialog; GNOME's interactive dialog may time out and shut down. Do not treat it as a safe lock-screen command. Never test power-button changes during unsaved work.

## Structure / agents

```text
profiles/           named bundles of modules
modules/            atomic declarative GSettings changes
src/fedora_mac_like/ installer, validator, backup, rollback, diagnostics
scripts/            explicit privileged/system helpers
docs/               architecture, compatibility, power, keymap, agent contract
tests/              offline unit tests
.github/workflows/  CI validation
```

Each agent should implement a narrowly scoped module or documentation change, run `validate` and tests, and open a PR. Read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Supported and not supported

Designed for Fedora Workstation GNOME on Wayland; Fedora/gnome-shell schema versions vary, so unsupported keys are **reported and skipped** rather than written blindly. Other distros, KDE, X11, and laptops with nonfunctional Linux suspend are **not** promised. This installer modifies the *current user's* settings, not every account on a machine.

Version: **0.1.0 initial foundation**, not yet hardware-validated on every Fedora release. No automatic installation of third-party extensions, key remappers, or root services.
