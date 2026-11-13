# Compatibility policy

Primary target: Fedora Workstation GNOME/Wayland with existing supported kernel input drivers. Fedora release changes may rename or remove GSettings keys, so the installer checks each key and **skips unsupported settings**, returning status 2. No kernel/ACPI/firmware repair is bundled.

Hardware profile inventory must record: Fedora version, GNOME Shell version, XDG_SESSION_TYPE, laptop model, input stack, power-button short press owner, low-level inhibitors, and whether suspend/resume was actually tested.

ASUS Zenbook A16 (Snapdragon X2) is a **validation target, not a guarantee**. System boot, kernel modules, EC, ACPI, and hardware suspension belong to your kernel/firmware stack and are out of this user-config repo. A GNOME power-action setting cannot fix a broken suspend driver.

A setting that fails on a target must be documented and gated instead of silently disabling existing hardware functions.
