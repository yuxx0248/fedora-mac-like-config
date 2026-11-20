# Drag to reorder workspaces (GNOME 51)

This opt-in first-party GNOME Shell extension adds a small white grab handle at
the upper left of each workspace preview. Drag the handle in Overview or the
application grid to reorder workspaces. Dragging elsewhere retains the normal
window and application behavior. Windows remain on their workspace; the active
workspace follows GNOME's normal reorder behavior. In dynamic-workspace mode,
the final empty workspace is reserved for GNOME and cannot itself be reordered.

In the thumbnail row, an insertion gap approximately one thumbnail wide shows
the destination. Drop at the first thumbnail's left edge to move a workspace to
the start, or at the right edge of the final empty thumbnail to put it after the
other populated workspaces. In the application grid, drop a handle on the left or
right half of a workspace preview to choose its position.

This experimental extension is disabled in the currently validated configuration: the user reported missing Overview previews while it was enabled. Keep it disabled until that interaction has been investigated.

The extension targets GNOME Shell 51 on Wayland and uses private Shell thumbnail
and drag-and-drop APIs. It may conflict with other overview extensions. Workspace
numbers can change, so extensions or scripts that select a numbered workspace,
including ZCode Auto Place, may target a different workspace after a reorder. The
fullscreen workspace extension treats the leftmost workspace as the main one, so
reordering also changes its destination. This is not installed by default.

From the repository root:

```bash
package_dir=$(mktemp -d)
gnome-extensions pack integrations/workspace-reorder/workspace-reorder@fedora-mac-like-config --out-dir "$package_dir"
gnome-extensions install "$package_dir/workspace-reorder@fedora-mac-like-config.shell-extension.zip"
gnome-extensions enable workspace-reorder@fedora-mac-like-config
```

If Shell does not discover the extension yet, log out and back in, then enable it.
Do not replace an existing extension with this UUID without inspecting it. No
session is restarted automatically. To undo:

```bash
gnome-extensions disable workspace-reorder@fedora-mac-like-config
gnome-extensions uninstall workspace-reorder@fedora-mac-like-config
```

Test interactively in Overview and the application grid with several populated workspaces: drag in both
directions, click a thumbnail without dragging, drag a window between workspaces,
cancel a drag, and test both fixed and dynamic workspace modes. Check behavior
with multiple monitors and other overview extensions. These interactions have not
been verified on real Fedora hardware. If loading fails, inspect `gnome-extensions
info workspace-reorder@fedora-mac-like-config` and the Shell user journal.
