# Agent instructions (apply to all contributors)

Repo mission: Fedora Workstation GNOME/Wayland -> macOS-like **interactions**, reproducible and reversible.

## Boundaries

- No unrelated OS theming assets, boot animation, wallpaper, kernel patches, or system firmware changes.
- Keep all user settings in small declarative \`modules/\`; bundle via \`profiles/\`. A module has one clear purpose.
- Respect explicit user settings; never make the default install force-overwrite them.
- No implicit \`sudo\`, auto-restarts of logind, GNOME Shell, or services; power management must remain opt-in and separately documented.
- Do not promise that \`HandlePowerKey\` overrides GNOME's low-level inhibitors.
- No curl-pipe-bash, downloading arbitrary binaries, or unpinned third-party GNOME extensions in the default installer.
- New module values must be literal GVariant values and map to verifiable GNOME GSettings schemas.
- Any new privileged helper must be dedicated, idempotent, refuse unmanaged files, and include a clean removal path.

## Before check-in

1. Read \`docs/architecture.md\`, \`docs/power.md\`, and \`docs/compatibility.md\`.
2. Run \`python3 src/fedora_mac_like/cli.py validate\`.
3. Run \`PYTHONPATH=src python3 -m unittest discover -s tests -v\`, \`bash -n install.sh scripts/*.sh\`.
4. Write down what was **not** tested on real Fedora hardware; CI does not equal verified GNOME functionality.
5. Use focused PRs with module ownership, exact GNOME schema/source, expected behavior, test steps, failure/rollback behavior, and compatibility notes.

Do not change already configured local user shortcuts without explicit user authorization. Do not auto-test suspend or power keys in unattended sessions.
