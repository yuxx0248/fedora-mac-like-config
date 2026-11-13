# Keyboard and gestures

GNOME's native Super key often fills macOS Command's role in desktop actions (Overview, window management), but text editing in Linux apps normally stays on **Ctrl**. Blindly swapping Ctrl and Super globally would break terminal control sequences, app shortcuts, and some compositor accelerators.

The default profile therefore changes **workspace shortcuts** only. It uses Ctrl+Super+Left/Right instead of Cmd-like Ctrl+Left/Right, which many editors use for word navigation. Existing explicit user shortcuts are preserved unless \`--force\` is passed.

Optional \`--module caps-escape\` uses the GNOME \`org.gnome.desktop.input-sources xkb-options\` setting; its declarative value **replaces** the whole XKB option list. Review your current options first. No modifier remap ships by default.

Touchpad:
- 2 fingers: natural scroll and secondary-click behavior controlled by GNOME settings.
- 3 fingers: GNOME Shell's native workspace/Overview swipe gestures on Wayland.
- 4 fingers and custom per-app swipe actions: **not installed**; extensions and compositors can conflict. Future optional adapters must be GNOME-version-pinned, tested, and uninstallable.

Future opt-in remapper modules may use xremap/keyd, but must document security/device access, key repeat, per-app exclusions (especially terminals), Wayland limitations, launch on login, and reversible uninstall.
