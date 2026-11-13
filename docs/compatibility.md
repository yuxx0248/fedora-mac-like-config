# Compatibility policy

Primary target: Fedora Workstation GNOME/Wayland with existing supported kernel input drivers. Fedora release changes may rename or remove GSettings keys, so the installer checks each key and **skips unsupported settings**, returning status 2. No kernel/ACPI/firmware repair is bundled.

Hardware profile inventory must record: Fedora version, GNOME Shell version, XDG_SESSION_TYPE, laptop model, input stack, power-button short press owner, low-level inhibitors, and whether suspend/resume was actually tested.

ASUS Zenbook A16 (Snapdragon X2) is a **validation target, not a guarantee**. System boot, kernel modules, EC, ACPI, and hardware suspension belong to your kernel/firmware stack and are out of this user-config repo. A GNOME power-action setting cannot fix a broken suspend driver.

A setting that fails on a target must be documented and gated instead of silently disabling existing hardware functions.

## Hardware validation inventory

### ASUS Zenbook A16 (UX3607O, Snapdragon) — 2026-11-13

- Fedora (Zen kernel variant), GNOME Shell 51.0, `XDG_SESSION_TYPE=wayland`, dbus-broker.
- Power-button short press owner: user session (`pmic_pwrkey` evdev -> `fml-power-blank.service`), GNOME `power-button-action='nothing'`, logind drop-in `HandlePowerKey=ignore`.
- Keyboard backlight: `asus::kbd_backlight` (0-3), idle auto-dim by GNOME observed; LED writes via passwordless sudo `tee` (udev MODE/GROUP does not apply to sysfs).
- Screen blank + LED restore observed interactively over repeated cycles; long press suspend left to logind. Suspend/resume quality not exhaustively tested.
- The A16 has no dedicated lock/blank key; Fn is firmware-consumed, so the power button is the closest macOS Touch-ID-style analog.
- Input stack note: typing is routed through a keyd-style remapper (`*keyd virtual keyboard` uinput devices). libinput DWT ignores them unless the opt-in udev rule (`scripts/keyd-dwt.sh`, `LIBINPUT_ATTR_KEYBOARD_INTEGRATION=internal`) is installed; a GNOME Wayland session only reads the attribute at login. Observed without the rule: touchpad pointer motion interleaved with keystrokes popped the auto-hide bottom dock during typing (2026-11-13, `libinput debug-events` capture).
