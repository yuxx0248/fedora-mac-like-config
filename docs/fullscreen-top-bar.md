# Fullscreen top bar (GNOME 51)

The bundled GNOME Shell extension reveals the existing top bar when the pointer reaches
the top two pixels of the primary monitor during fullscreen. It slides away when the
pointer leaves the bar; an open panel menu keeps it visible until closed. It does not
create application menu items or change shortcuts. The bar belongs to the primary
monitor; fullscreen on another monitor does not reveal a second bar.

This is an experimental, first-party integration for GNOME Shell 51 only, not a
GSettings module. The default installer installs it on GNOME Shell 51. It relies on Shell internals and can
conflict with extensions that manage the top bar. The extension was observed ACTIVE on GNOME Shell 51 / Wayland; its interactive behavior has not been independently verified; multi-monitor arrangements, scaling, overview, lock screen,
menu interaction, and fullscreen games need interactive testing. Pointer polling runs
inside GNOME Shell at 100 ms intervals. On displays positioned directly above the primary
monitor, the pointer must stop at its top edge to trigger the bar.

From the repository root, package and install it for the current user:

```bash
mkdir -p /tmp/fml-extension-package
gnome-extensions pack integrations/fullscreen-top-bar/fullscreen-top-bar@fedora-mac-like-config --out-dir /tmp/fml-extension-package
gnome-extensions install /tmp/fml-extension-package/fullscreen-top-bar@fedora-mac-like-config.shell-extension.zip
```

GNOME Shell may need a **manual logout and login** before it discovers a newly installed
extension on Wayland. Then enable it and check its state:

```bash
gnome-extensions enable fullscreen-top-bar@fedora-mac-like-config
gnome-extensions info fullscreen-top-bar@fedora-mac-like-config
```

No session or service is restarted automatically. If packaging a
second time, remove the existing package in `/tmp/fml-extension-package` first. If the
UUID is already installed, inspect it before replacing it; the command above does not
force overwrite it.

Test with a fullscreen window on the primary display: move to the top edge, use the
clock and quick settings menus, move away, then exit fullscreen and open Overview.
Test other displays and any other panel extensions in use. If the extension fails to
load, inspect `gnome-extensions info fullscreen-top-bar@fedora-mac-like-config` and
`journalctl --user -b /usr/bin/gnome-shell`.

To undo the integration:

```bash
gnome-extensions disable fullscreen-top-bar@fedora-mac-like-config
gnome-extensions uninstall fullscreen-top-bar@fedora-mac-like-config
```

Disabling returns visibility control to GNOME Shell. No user settings are changed.
Implementation reference: [GNOME Shell 51 layout.js](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/gnome-51/js/ui/layout.js)
tracks the panel as fullscreen-sensitive chrome; this extension uses its visibility and
primary-monitor state and restores Shell's visibility calculation on disable.
