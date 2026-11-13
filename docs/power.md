# Power button: ownership, policy, and tests

**Never equate a short press to a long press or a BIOS/EC hard power-off.** Firmware long-press forced shutdown is generally not controlled by GNOME.

## GNOME session (preferred)

```bash
gsettings range org.gnome.settings-daemon.plugins.power power-button-action
gsettings get   org.gnome.settings-daemon.plugins.power power-button-action
./install.sh --dry-run --power interactive
./install.sh --power interactive          # show GNOME power dialog (may time out and power off)
./install.sh --power suspend              # only after suspend/resume is proven reliable!
./install.sh --power nothing              # do nothing on short press, if GNOME honors it
```

The default install **does not touch** the power button. GNOME's supported values are normally `interactive`, `suspend`, `hibernate`, `nothing`; manifest exposes the first three (hibernate is intentionally withheld without testing). `interactive` is **not** a safe "lock" shortcut: some GNOME power dialogs automatically power off after a timeout.

A16 / ARM64: do not select suspend automatically until you have validated wakeup, Wi-Fi resume, touchscreen/touchpad, NVMe, audio, and repeated cycles with the kernel actually installed. Do not test with unsaved work. Prefer GNOME's existing `Super+L` to lock the screen.

## systemd-logind fallback (root; optional)

```bash
./scripts/power-system.sh set lock      # or suspend, ignore, poweroff
./scripts/power-system.sh remove
systemd-analyze cat-config systemd/logind.conf
loginctl list-inhibitors
```

The helper writes only `/etc/systemd/logind.conf.d/90-fedora-mac-like-power.conf`, refuses an unmanaged existing file, and **never restarts logind**. Reboot to apply/check. **Low-level `handle-power-key` inhibitors taken by GNOME supersede `HandlePowerKey=`**. A `lock` action configured only in logind is **not guaranteed** while GNOME owns the power button. Do not claim that pressing the key will lock without hardware verification.

Systemd drop-in precedence also depends on other `*.conf` files and later lexical ordering. Check effective configuration and inhibitors, not just file presence. A laptop firmware/EC, fingerprint-power combo keys, or vendor ACPI behavior may be outside either layer.

## Short press = screen blank (opt-in user services; hardware-validated on ASUS Zenbook A16)

Not part of any profile and never run by the default installer. Two narrowly scoped **user** services
(no root daemon; the only privileged step is an optional, explicitly invoked logind drop-in):

- `fml-power-blank.service` — watches the platform power-key evdev device (`pmic_pwrkey`) and calls
  `org.gnome.ScreenSaver.SetActive true` on short press. Background processes, shell jobs, and
  systemd timers keep running; waking by any input returns to the unlocked session.
- `fml-kbd-backlight-watcher.service` — listens for the GNOME ScreenSaver `ActiveChanged` signal and
  turns the keyboard backlight (`asus::kbd_backlight`) off while blanked, restoring it on wake.

```bash
./install.sh --module power-nothing     # required first: GNOME must not suspend on the same press
./scripts/power-blank.sh install        # user services only, no root
./scripts/power-blank.sh install-logind # optional: HandlePowerKey=ignore + HandlePowerKeyLongPress=suspend
./scripts/power-blank.sh status
./scripts/power-blank.sh remove remove-logind   # full uninstall
```

Requirements and validated caveats (Fedora, GNOME 51, Wayland, dbus-broker):

- GNOME `power-button-action` must be `'nothing'` (the installer refuses otherwise), otherwise GNOME
  acts on the same short press in parallel.
- The logind drop-in writes `HandlePowerKey=ignore` so logind does not power off, and
  `HandlePowerKeyLongPress=suspend` for a macOS-like long press. Per the policy above, GNOME-side
  inhibitors still take precedence where present; verify with `loginctl list-inhibitors`. At the GDM
  greeter the user services are not running, so a short press does nothing there.
- The keyboard LED lives in a root-owned sysfs file. udev `MODE`/`GROUP` does **not** apply to sysfs
  attribute files, so the watcher uses passwordless `sudo -n tee`. Without a NOPASSWD rule it degrades
  to a no-op (screen blank is unaffected). Minimal sudoers fragment (adjust the user):

  ```
  <user> ALL=(root) NOPASSWD: /usr/bin/tee /sys/class/leds/asus::kbd_backlight/brightness
  ```

- dbus-broker only allows the owning UID to connect to the user session bus (root included), which is
  why the LED watcher runs as the user and escalates for the single write instead of running as root.
- GNOME's own idle auto-dim of the keyboard backlight may already have set the LED to 0 before a
  blank; the watcher then restores the default level (2 of 0-3) on wake instead of a stale snapshot.
- The `ActiveChanged` signal arrives from two senders per transition; transitions are tracked
  explicitly, so the restore value is captured once.
- The power-key daemon requires the `pmic_pwrkey` evdev device (present on the validated A16); on
  other hardware it exits cleanly and the unit stays inactive.

Hardware validation record (ASUS Zenbook A16 UX3607O, 2026-11-13): short press blanks screen and
keyboard LED, wake restores LED and returns to the unlocked session, long press suspends, background
timers unaffected; repeated cycles observed interactively. Suspend/resume quality itself remains
kernel/firmware territory and is covered by the suspend checklist above.

## Validation checklist

1. Run `doctor`, record GNOME, Wayland, active inhibitors and effective logind configuration.
2. Confirm short press behavior with all work saved.
3. Confirm long-press firmware behavior is left unchanged; do not experimentally force shutdown.
4. If choosing suspend, test repeated suspend/wake, on battery and AC, and attached displays, then capture `journalctl -b` for any fault.
5. `rollback` GNOME changes or `power-system.sh remove` the managed logind drop-in; reboot if system policy changed.

References:
- https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html
- https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/administering_rhel_by_using_the_gnome_desktop_environment/
