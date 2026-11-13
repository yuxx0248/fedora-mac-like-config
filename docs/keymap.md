# Keyboard and gestures

GNOME's native Super key often fills macOS Command's role in desktop actions (Overview, window management), but text editing in Linux apps normally stays on **Ctrl**. Blindly swapping Ctrl and Super globally would break terminal control sequences, app shortcuts, and some compositor accelerators.

The default profile therefore changes **workspace shortcuts** only. It uses Ctrl+Super+Left/Right instead of Cmd-like Ctrl+Left/Right, which many editors use for word navigation. Existing explicit user shortcuts are preserved unless `--force` is passed.

Optional `--module caps-escape` uses the GNOME `org.gnome.desktop.input-sources xkb-options` setting; its declarative value **replaces** the whole XKB option list. Review your current options first. No modifier remap ships by default.

Touchpad:
- 2 fingers: natural scroll and secondary-click behavior controlled by GNOME settings.
- 3 fingers: GNOME Shell's native workspace/Overview swipe gestures on Wayland.
- 4 fingers and custom per-app swipe actions: **not installed**; extensions and compositors can conflict. Future optional adapters must be GNOME-version-pinned, tested, and uninstallable.

Future opt-in remapper modules may use xremap/keyd, but must document security/device access, key repeat, per-app exclusions (especially terminals), Wayland limitations, launch on login, and reversible uninstall.

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
