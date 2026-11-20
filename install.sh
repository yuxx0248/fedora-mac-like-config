#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
profile=default
dry_run=false
help_requested=false
expect_profile=false
for arg in "$@"; do
    if "$expect_profile"; then profile="$arg"; expect_profile=false; continue; fi
    case "$arg" in
        --profile) expect_profile=true ;;
        --profile=*) profile="${arg#--profile=}" ;;
        --dry-run) dry_run=true ;;
        -h|--help) help_requested=true ;;
    esac
done
python3 "$ROOT/src/fedora_mac_like/cli.py" apply "$@"
if [ "$profile" = default ] && ! "$help_requested"; then
    if "$dry_run"; then
        "$ROOT/scripts/default-shell-extensions.sh" --dry-run
    else
        "$ROOT/scripts/default-shell-extensions.sh"
    fi
fi
