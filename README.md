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

The default profile applies touchpad settings, workspace shortcuts, macOS-style screenshot chords, and left-side titlebar buttons. **Existing explicit user settings are preserved by default.** Every changed key is backed up first.

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
| Screenshot chords | Shift+physical-Alt+3/4 (Cmd-like), Print variants kept; captures auto-save to `~/Pictures/Screenshots` | GNOME Shell keybindings |
| Window buttons | Close/minimize/maximize on left | GNOME WM preferences |
| Power button | **Unchanged unless `--power` is given** | GNOME GSettings |
| Power short-press = screen blank | **Unchanged unless `scripts/power-blank.sh install` is run** | opt-in user services + logind drop-in |
| Caps Lock | **Unchanged unless `--module caps-escape` is given** | GNOME input sources |
| keyd touchpad DWT | **Unchanged unless `scripts/keyd-dwt.sh install` is run** | opt-in udev rule |
| Modifier layout (mac bottom row + dual-role physical Ctrl) | **Unchanged unless `scripts/mac-kbd-layout.sh install` is run** | opt-in udev hwdb + keyd config |

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

A macOS-like **short press = screen blank** (screen and keyboard backlight off, background processes and timers keep running, no lock) is available as a separate opt-in integration of two user services; it is not part of any profile and requires `--module power-nothing` first:

```bash
./install.sh --module power-nothing
./scripts/power-blank.sh install
./scripts/power-blank.sh install-logind   # optional root fallback (greeter/non-GNOME)
./scripts/power-blank.sh status | remove
```

It is hardware-validated on one machine only (ASUS Zenbook A16, GNOME 51, Wayland, dbus-broker). See [docs/power.md](docs/power.md) for requirements, the keyboard-backlight sudo note, and removal.

## If you remap your keyboard with keyd: touchpad disable-while-typing

keyd's virtual keyboard is external to libinput, so GNOME's "disable touchpad while typing" does not
apply while typing is routed through it; palm contact then moves the pointer. An opt-in, one-rule
integration tags those devices as built-in:

```bash
./scripts/keyd-dwt.sh install   # root; needs a GNOME Wayland re-login to take effect
./scripts/keyd-dwt.sh status | remove
```

Not part of any profile; never run by the default installer. See [docs/keymap.md](docs/keymap.md).

## macOS-like bottom-row modifier layout (opt-in, Zenbook A16)

On the validated machine the bottom-left physical row is laid out mac-style at the evdev level:
physical Alt sits in the Command position (emits Ctrl, so Alt+C is "copy" and Alt+Shift+3/4 are the
screenshot chords), physical Win is Option (Alt), and physical Ctrl becomes a dual-role key — tap
opens Overview (Super), held it delivers real Ctrl chords, with Ctrl+C encoded as Ctrl+Shift+C so
the terminal receives a true SIGINT while GNOME Terminal's copy binding (`<Control>c`) keeps
physical Alt+C as "copy". This ships as one udev hwdb file plus one keyd config, installed by:

```bash
./scripts/mac-kbd-layout.sh install   # root; the hwdb keymap reaches an already-open keyboard only after a reboot
./scripts/mac-kbd-layout.sh status | remove
```

Not part of any profile; never run by the default installer. Hardware-validated on ASUS Zenbook A16
(keyboard `0B05:4B42`) only, and the keyd `[ids]` section assumes that keyboard. Pairing: the
`screenshot` module's chords assume physical Alt = Ctrl from this layout. See [docs/keymap.md](docs/keymap.md).

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
