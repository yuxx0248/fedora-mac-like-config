# Keyboard and gestures

GNOME's native Super key often fills macOS Command's role in desktop actions (Overview, window management), but text editing in Linux apps normally stays on **Ctrl**. Blindly swapping Ctrl and Super globally would break terminal control sequences, app shortcuts, and some compositor accelerators.

The default profile therefore changes **workspace shortcuts** only. It uses Ctrl+Super+Left/Right instead of Cmd-like Ctrl+Left/Right, which many editors use for word navigation. Existing explicit user shortcuts are preserved unless `--force` is passed.

Optional `--module caps-escape` uses the GNOME `org.gnome.desktop.input-sources xkb-options` setting; its declarative value **replaces** the whole XKB option list. Review your current options first. No modifier remap ships by default.

Touchpad:
- 2 fingers: natural scroll and secondary-click behavior controlled by GNOME settings.
- 3 fingers: GNOME Shell's native workspace/Overview swipe gestures on Wayland.
- 4 fingers and custom per-app swipe actions: **not installed**; extensions and compositors can conflict. Future optional adapters must be GNOME-version-pinned, tested, and uninstallable.

Future opt-in remapper modules may use xremap/keyd, but must document security/device access, key repeat, per-app exclusions (especially terminals), Wayland limitations, launch on login, and reversible uninstall.

## Screenshot chords (default profile, `screenshot` module)

macOS-style capture chords via `org.gnome.shell.keybindings`: `Shift+physical Alt+3` opens the
interactive capture, `Shift+physical Alt+4` the capture UI, `physical Alt+Print` captures the
focused window; `Print`/`Shift+Print` stay configured as on the validated machine. GNOME saves
captures automatically to `~/Pictures/Screenshots/` and mirrors them to the clipboard.

**Modifier caveat:** "physical Alt" means the macOS Command position. On the validated A16 this
works because a machine-local hwdb rule (`/etc/udev/hwdb.d/90-mac-style-kbd.hwdb`) maps physical
left Alt to `Ctrl` at the evdev level; that rule is owned by the opt-in `mac-kbd-layout`
integration (`scripts/mac-kbd-layout.sh`), not by any profile. On an unremapped keyboard the same
manifest applies plain `Ctrl+Shift+3/4`, which loses the Cmd-like meaning and may collide with app
shortcuts. Review with `--dry-run` on other machines; explicit pre-existing values are preserved
unless `--force`.

## Modifier layout: mac bottom row + dual-role physical Ctrl (opt-in `mac-kbd-layout`)

Machine-validated layout for the ASUS Zenbook A16 (keyboard `0B05:4B42`), installed by
`scripts/mac-kbd-layout.sh` as one udev hwdb file plus one keyd config (both with a management
marker; neither is part of any profile):

| Physical key | Emits | Role |
| --- | --- | --- |
| left Ctrl | tap = Super (Overview); held = Ctrl chords | mac Command position, dual role |
| Fn | unchanged | consumed by EC firmware, unreachable |
| left Win | Alt | Option position |
| left Alt (next to Space) | Ctrl | Command-role modifier; Alt+C = copy, Alt+Shift+3/4 = screenshots |

Why the physical Ctrl key is dual-role instead of a plain swap: GNOME Terminal keeps its
mac-style `copy = <Control>c` accelerator by design, which would swallow every plain Ctrl+C before
it reaches the terminal. The keyd config therefore rewrites only the `c` key inside the
held-Ctrl layer to emit `Ctrl+Shift+C`: the accelerator does not match that chord, and VTE encodes
`Ctrl+Shift+C` as `0x03` — the same byte as Ctrl+C — so the child process sees a real SIGINT.
Held-physical-Ctrl+Space still emits Super+Space for the input-method switch via an explicit
binding.

Caveats learned on hardware (2026-11-16):

- An already-open keyboard device did not pick up a new hwdb keymap from
  `udevadm trigger` alone; the hwdb half reliably needs one reboot.
- `keyd reload` applies config changes live, but verify all chords afterwards; a daemon that was
  stopped/started mid-session once left stale behavior behind until another restart.
- Third-party grabbers that forward key events (e.g. the Handy dictation app's "handy-keys"
  passthrough) sit between keyd and GNOME and can garble forwarded modifiers after a reboot race;
  if chords die after login, quit that app and retest before touching keyd or hwdb.
- Physical Ctrl+chords in GUI apps outside terminals deliver the plain Ctrl chord from the held
  layer (only `c` gains Shift), so browser devtools-style Ctrl+Shift+C collisions are limited to
  the copy key itself; copy stays on physical Alt+C everywhere, as on macOS.

## keyd remappers: make disable-while-typing apply (opt-in udev integration)

A keyd-style remapper synthesizes a **virtual** keyboard, which libinput classifies as external.
libinput's disable-while-typing (DWT) only suppresses the touchpad for *internal* keyboards, so on a
remapped laptop, palm contact while typing keeps moving the pointer (observed symptom on the A16: the
auto-hide bottom dock pops up during typing). `scripts/keyd-dwt.sh` installs one pure tagging rule,
`/etc/udev/rules.d/99-keyd-internal-keyboard.rules`, setting
`ENV{LIBINPUT_ATTR_KEYBOARD_INTEGRATION}="internal"` on `*keyd virtual keyboard` devices (the glob
covers remapper passthrough names too):

```bash
./scripts/keyd-dwt.sh install   # root; writes the rule, reloads udev, reprocesses input devices
./scripts/keyd-dwt.sh status    # rule state + which devices carry the attribute
./scripts/keyd-dwt.sh remove    # removes the managed rule
```

Caveats:

- Not part of any profile and never run by the default installer; requires an explicit `sudo`.
- The rule only tags devices (no `RUN+=`/helper execution); with keyd not running it matches nothing
  and stays harmless until the device appears.
- **A GNOME Wayland session started before the rule only reads the attribute at login.** Installing
  mid-session changes nothing until you log out and back in; `remove` likewise keeps the running
  session's behavior until the next login. No service is restarted by the script.
- Verify after re-login: `sudo libinput list-devices` shows the touchpad `Disable-w-typing: enabled`
  and the keyd devices carry the integration attribute; during typing, `sudo libinput debug-events`
  should record no touchpad pointer motion within ~0.5s of keystrokes.
- DWT is libinput's own ~0.5s window: it does not suppress palm contact after the window, so brief
  post-typing grazing can still move the pointer. Auto-hide dock sensitivity is a separate,
  user-owned choice (e.g. dash-to-dock `show-delay`).
