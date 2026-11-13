# Contributing

Use a branch and PR for each focused change. If adding a setting, include the exact schema/key/GVariant and its upstream documentation or source, explain clashes, update docs, and test \`--dry-run\`, apply, status, and rollback on a clean GNOME profile where possible. The main default profile is stable; experimental hardware-specific behavior should live in an opt-in module.

Automated checks:
\`\`\`bash
python3 src/fedora_mac_like/cli.py validate
PYTHONPATH=src python3 -m unittest discover -s tests -v
bash -n install.sh scripts/*.sh
\`\`\`

No one should claim hardware support without actually observing it. Power-button and suspend changes always require manual testing and explicit selection.
