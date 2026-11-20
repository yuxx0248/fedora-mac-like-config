# Larger workspace thumbnails in Overview (GNOME 51)

This first-party GNOME Shell extension raises the maximum height of the
workspace thumbnail row in the window Overview from 5% to 15% of the monitor's
work area, close to the 15% workspace row GNOME uses on the applications page.
GNOME's own layout gives the row more space and reduces the central window-preview
area accordingly. Depending on workspace count, available width, scaling, monitor
layout and theme, the actual sizes may differ and thumbnails may be smaller.
The applications page and workspace ordering are not changed. The extension keeps
the overview thumbnail row visible even when GNOME has only one populated dynamic
workspace and its empty spare; disabling it restores GNOME's default visibility.

This uses GNOME Shell 51 private layout APIs, not a GSettings preference. It may
conflict with other overview layout extensions, and is installed by the default installer on GNOME Shell 51. The user must test layout and dragging on the target hardware; this
integration has not been verified interactively in a live Fedora session.

To install for the current user from the repository root:

```bash
package_dir=$(mktemp -d)
gnome-extensions pack integrations/overview-workspace-size/overview-workspace-size@fedora-mac-like-config --out-dir "$package_dir"
gnome-extensions install "$package_dir/overview-workspace-size@fedora-mac-like-config.shell-extension.zip"
gnome-extensions enable overview-workspace-size@fedora-mac-like-config
```

On Wayland, a newly installed extension may require manual logout and login before
Shell discovers it. If the UUID already exists, inspect it before replacement.
To undo:

```bash
gnome-extensions disable overview-workspace-size@fedora-mac-like-config
gnome-extensions uninstall overview-workspace-size@fedora-mac-like-config
```

Check Overview and the applications page, different workspace counts, drag-and-drop,
scaling and multi-monitor layouts. For loading errors, inspect `gnome-extensions
info overview-workspace-size@fedora-mac-like-config` and the Shell user journal.
Implementation reference: [GNOME Shell 51 overview layout](https://github.com/GNOME/gnome-shell/blob/gnome-51/js/ui/overviewControls.js).
