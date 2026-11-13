# Power button: ownership, policy, and tests

**Never equate a short press to a long press or a BIOS/EC hard power-off.** Firmware long-press forced shutdown is generally not controlled by GNOME.

## GNOME session (preferred)

\`\`\`bash
gsettings range org.gnome.settings-daemon.plugins.power power-button-action
gsettings get   org.gnome.settings-daemon.plugins.power power-button-action
./install.sh --dry-run --power interactive
./install.sh --power interactive          # show GNOME power dialog (may time out and power off)
./install.sh --power suspend              # only after suspend/resume is proven reliable!
./install.sh --power nothing              # do nothing on short press, if GNOME honors it
\`\`\`

The default install **does not touch** the power button. GNOME's supported values are normally \`interactive\`, \`suspend\`, \`hibernate\`, \`nothing\`; manifest exposes the first three (hibernate is intentionally withheld without testing). \`interactive\` is **not** a safe "lock" shortcut: some GNOME power dialogs automatically power off after a timeout.

A16 / ARM64: do not select suspend automatically until you have validated wakeup, Wi-Fi resume, touchscreen/touchpad, NVMe, audio, and repeated cycles with the kernel actually installed. Do not test with unsaved work. Prefer GNOME's existing \`Super+L\` to lock the screen.

## systemd-logind fallback (root; optional)

\`\`\`bash
./scripts/power-system.sh set lock      # or suspend, ignore, poweroff
./scripts/power-system.sh remove
systemd-analyze cat-config systemd/logind.conf
loginctl list-inhibitors
\`\`\`

The helper writes only \`/etc/systemd/logind.conf.d/90-fedora-mac-like-power.conf\`, refuses an unmanaged existing file, and **never restarts logind**. Reboot to apply/check. **Low-level \`handle-power-key\` inhibitors taken by GNOME supersede \`HandlePowerKey=\`**. A \`lock\` action configured only in logind is **not guaranteed** while GNOME owns the power button. Do not claim that pressing the key will lock without hardware verification.

Systemd drop-in precedence also depends on other \`*.conf\` files and later lexical ordering. Check effective configuration and inhibitors, not just file presence. A laptop firmware/EC, fingerprint-power combo keys, or vendor ACPI behavior may be outside either layer.

## Validation checklist

1. Run \`doctor\`, record GNOME, Wayland, active inhibitors and effective logind configuration.
2. Confirm short press behavior with all work saved.
3. Confirm long-press firmware behavior is left unchanged; do not experimentally force shutdown.
4. If choosing suspend, test repeated suspend/wake, on battery and AC, and attached displays, then capture \`journalctl -b\` for any fault.
5. \`rollback\` GNOME changes or \`power-system.sh remove\` the managed logind drop-in; reboot if system policy changed.

References:
- https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html
- https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/administering_rhel_by_using_the_gnome_desktop_environment/
