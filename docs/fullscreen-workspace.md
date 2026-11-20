# Fullscreen workspace isolation (GNOME 51)

This first-party GNOME Shell extension moves newly created normal windows opened
from a fullscreen workspace to workspace 1. It also checks where the window was
launched from, because a launcher can assign the window to a different workspace.
If workspace 1 contains a fullscreen window, it appends a new workspace instead.
When appropriate, it follows the new window.

When a normal window becomes fullscreen, other normal windows on that workspace
move to workspace 1. If workspace 1 itself becomes fullscreen, the extension
creates a workspace to its left and moves those windows there; the fullscreen
window remains active. If another workspace becomes fullscreen while workspace 1
is already fullscreen, it creates a workspace for the other windows instead.
The extension also rechecks when a fullscreen window moves between workspaces or
is restored from minimization. This changes workspace numbering; exiting fullscreen
does not move windows back.

Previously hidden windows shown again are not treated as new. Dialogs, transient
and sticky windows stay with their apps. Ulauncher, Handy windows and the
`wl-clipboard` helper used when Handy pastes transcription are exempt. Applications
launched from Ulauncher are still subject to the new-window rule. A link or launcher that
only activates an existing application window does not create a new window and is
not moved by the new-window rule. Minimized fullscreen windows do not reserve a
workspace.

GNOME 51 on Wayland is the only targeted version. With primary-only workspaces,
windows on secondary monitors can be visible across workspaces; test multi-monitor
setups separately. Other extensions that move windows or fullscreen them later can
change the result (including the locally installed ZCode Auto Place extension). This
integration uses Shell internals and is separate from the default installer and profiles.

## Automatic cleanup of empty workspaces

To match the dynamic workspace behavior, apply the dedicated profile:

```bash
./install.sh --profile dynamic-workspaces --dry-run
./install.sh --profile dynamic-workspaces
```

This profile only manages `org.gnome.mutter dynamic-workspaces=true`; it does not
change shortcuts, install the extension, or change other settings. The installer
preserves an explicit existing `false` value unless `--force` is supplied. GNOME
removes empty workspaces automatically and generally keeps one empty workspace;
workspace numbers may change. Applications or extensions that depend on a fixed
workspace number, such as ZCode Auto Place, may therefore behave differently.
The overview does not gain a manual delete button. Check the effective value with
`gsettings get org.gnome.mutter dynamic-workspaces`. To restore a value changed
by the installer, use `python3 src/fedora_mac_like/cli.py rollback` and select the
appropriate backup if needed. Manually setting the value is not captured in an
installer backup.

## Fullscreen extension

Install for the current user from the repository root:

```bash
mkdir -p /tmp/fml-fullscreen-workspace-package
gnome-extensions pack integrations/fullscreen-workspace/fullscreen-workspace@fedora-mac-like-config --out-dir /tmp/fml-fullscreen-workspace-package
gnome-extensions install /tmp/fml-fullscreen-workspace-package/fullscreen-workspace@fedora-mac-like-config.shell-extension.zip
gnome-extensions enable fullscreen-workspace@fedora-mac-like-config
```

GNOME Shell may need a manual logout and login to discover a new extension on
Wayland. No session is restarted automatically. If a package or extension with this
UUID already exists, inspect it before replacing it. To undo:

```bash
gnome-extensions disable fullscreen-workspace@fedora-mac-like-config
gnome-extensions uninstall fullscreen-workspace@fedora-mac-like-config
```

Interactive checks: open a new browser window from a fullscreen application with
workspace 1 free, then repeat with workspace 1 fullscreen; verify the destination
and focus. Launch a new app from a fullscreen workspace, and fullscreen a window
with other apps on the first and another workspace; verify workspace order, focus
and destinations. Test Handy dictation again. Also test app dialogs, a link opening an existing browser window, multiple
monitors, fixed and dynamic workspaces, and other window placement extensions. Check
`gnome-extensions info fullscreen-workspace@fedora-mac-like-config` and
`journalctl --user -b /usr/bin/gnome-shell` if it does not load. These behaviors have
not been verified interactively on real Fedora hardware.
