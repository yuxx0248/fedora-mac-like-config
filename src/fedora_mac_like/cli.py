#!/usr/bin/env python3
"""Apply GNOME GSettings modules with non-destructive defaults and rollback.

No third-party Python packages. Run as the logged-in desktop user, not root.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]
STATE = Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local" / "state") / "fedora-mac-like-config"
SAFE_NAME = re.compile(r"^[a-z0-9-]+$")
POWER = {"interactive", "suspend", "nothing"}

class ConfigError(Exception):
    pass

def command(*args: str) -> str:
    result = subprocess.run(list(args), capture_output=True, text=True, check=False)
    if result.returncode:
        raise ConfigError(f"{' '.join(args)} failed: {result.stderr.strip() or result.stdout.strip()}")
    return result.stdout.strip()

def load_json(path: Path) -> dict:
    try:
        result = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigError(f"Invalid manifest {path}: {exc}") from exc
    if not isinstance(result, dict):
        raise ConfigError(f"Manifest must be an object: {path}")
    return result

def entries(profile: str, additions: list[str] | None = None, power: str | None = None) -> list[dict]:
    if not SAFE_NAME.fullmatch(profile):
        raise ConfigError("Invalid profile name")
    profile_data = load_json(ROOT / "profiles" / f"{profile}.json")
    names = profile_data.get("modules")
    if not isinstance(names, list) or not names or not all(isinstance(n, str) and SAFE_NAME.fullmatch(n) for n in names):
        raise ConfigError(f"Invalid modules in profile {profile}")
    modules = list(names) + list(additions or [])
    if power:
        if power not in POWER:
            raise ConfigError(f"Unsupported power action: {power}")
        modules.append("power-" + power)
    result, seen = [], {}
    for name in modules:
        if not SAFE_NAME.fullmatch(name):
            raise ConfigError(f"Invalid module name: {name}")
        data = load_json(ROOT / "modules" / f"{name}.json")
        settings = data.get("settings")
        if not isinstance(settings, list) or not settings:
            raise ConfigError(f"Module {name} has no settings")
        for setting in settings:
            if not isinstance(setting, dict) or not all(isinstance(setting.get(k), str) and setting[k] for k in ("schema", "key", "value")):
                raise ConfigError(f"Bad setting in {name}: {setting}")
            target = (setting["schema"], setting["key"])
            if target in seen:
                if seen[target] != setting["value"]:
                    raise ConfigError(f"Conflicting settings at {target} (module {name})")
                continue
            seen[target] = setting["value"]
            result.append(dict(setting, module=name))
    return result

def decision(current: str, user_value: str | None, wanted: str, force: bool) -> str:
    if current == wanted:
        return "already"
    if user_value is not None and not force:
        return "preserved"
    return "apply"

def dconf_path(item: dict) -> str:
    return "/" + item["schema"].replace(".", "/") + "/" + item["key"]

def read_setting(item: dict) -> tuple[str, str | None]:
    current = command("gsettings", "get", item["schema"], item["key"])
    explicit = command("dconf", "read", dconf_path(item)) or None
    return current, explicit

def prerequisites() -> None:
    if os.geteuid() == 0:
        raise ConfigError("Do not run the user installer with sudo/root")
    for executable in ("gsettings", "dconf"):
        if not shutil.which(executable):
            raise ConfigError(f"Required executable missing: {executable}")
    try:
        os_release = Path("/etc/os-release").read_text()
    except OSError:
        os_release = ""
    if not re.search(r"^ID=fedora$", os_release, re.MULTILINE):
        raise ConfigError("This installer targets Fedora Workstation; no changes made")
    desktop = os.getenv("XDG_CURRENT_DESKTOP", "")
    if "GNOME" not in desktop.upper():
        print("WARNING: GNOME session not detected; verify you are in Fedora GNOME.", file=sys.stderr)
    if os.getenv("XDG_SESSION_TYPE") != "wayland":
        print("WARNING: native GNOME touch gestures require a working Wayland session.", file=sys.stderr)

def plan(items: list[dict], force: bool) -> tuple[list[dict], int, int, int]:
    changes, preserved, already, unsupported = [], 0, 0, 0
    for item in items:
        target = f"{item['schema']} {item['key']}"
        try:
            current, explicit = read_setting(item)
        except ConfigError as exc:
            print(f"UNSUPPORTED {target}: {exc}", file=sys.stderr)
            unsupported += 1
            continue
        status = decision(current, explicit, item["value"], force)
        print(f"{status.upper():<10} {target}: {current} -> {item['value']}")
        if status == "apply":
            changes.append({"schema": item["schema"], "key": item["key"],
                            "before": current, "before_user": explicit, "desired": item["value"]})
        elif status == "preserved":
            preserved += 1
        else:
            already += 1
    return changes, preserved, already, unsupported

def save_snapshot(changes: list[dict], profile: str) -> Path:
    backup_dir = STATE / "backups" / (dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8])
    backup_dir.mkdir(parents=True, mode=0o700, exist_ok=False)
    payload = {"format": 1, "profile": profile, "created_utc": dt.datetime.now(dt.timezone.utc).isoformat(), "items": changes}
    tmp = backup_dir / "snapshot.json.tmp"
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.chmod(0o600)
    dest = backup_dir / "snapshot.json"
    tmp.replace(dest)
    return dest

def restore(items: list[dict], force: bool = False) -> tuple[int, int]:
    restored, skipped = 0, 0
    for item in reversed(items):
        target = f"{item['schema']} {item['key']}"
        try:
            current, _ = read_setting(item)
            if current != item["desired"] and not force:
                print(f"SKIP {target}: changed since install (use rollback --force to override)")
                skipped += 1
                continue
            if item["before_user"] is None:
                command("gsettings", "reset", item["schema"], item["key"])
            else:
                command("gsettings", "set", item["schema"], item["key"], item["before_user"])
            print(f"RESTORED {target}")
            restored += 1
        except ConfigError as exc:
            print(f"ERROR restoring {target}: {exc}", file=sys.stderr)
            skipped += 1
    return restored, skipped

def apply(args: argparse.Namespace) -> int:
    prerequisites()
    items = entries(args.profile, args.module, args.power)
    changes, preserved, already, unsupported = plan(items, args.force)
    if args.dry_run:
        print(f"DRY RUN: {len(changes)} would change, {preserved} preserved, {already} already set, {unsupported} unsupported")
        return 2 if unsupported else 0
    if not changes:
        print(f"No changes required ({preserved} preserved, {already} already set, {unsupported} unsupported).")
        return 2 if unsupported else 0
    backup = save_snapshot(changes, args.profile)
    applied = []
    try:
        for item in changes:
            command("gsettings", "set", item["schema"], item["key"], item["desired"])
            applied.append(item)
    except ConfigError as exc:
        print(f"INSTALL FAILED: {exc}; attempting automatic rollback.", file=sys.stderr)
        restore(applied, force=True)
        return 1
    print(f"Applied {len(applied)} setting(s); backup: {backup}")
    print("Log out/in if GNOME has not picked up all changes. Power settings must be tested on actual hardware.")
    if unsupported:
        print(f"WARNING: {unsupported} unsupported setting(s) were skipped.", file=sys.stderr)
        return 2
    return 0

def rollback(args: argparse.Namespace) -> int:
    prerequisites()
    backups = STATE / "backups"
    files = sorted(backups.glob("*/snapshot.json")) if backups.exists() else []
    if not files:
        raise ConfigError("No snapshots found")
    source = Path(args.snapshot).expanduser() if args.snapshot else files[-1]
    if not source.is_file():
        raise ConfigError(f"Snapshot not found: {source}")
    snapshot = load_json(source)
    if snapshot.get("format") != 1 or not isinstance(snapshot.get("items"), list):
        raise ConfigError("Unsupported snapshot format")
    done, skipped = restore(snapshot["items"], force=args.force)
    print(f"Restored {done}; skipped {skipped}; from {source}")
    return 2 if skipped else 0

def status(args: argparse.Namespace) -> int:
    prerequisites()
    items = entries(args.profile, args.module, args.power)
    mismatches = 0
    for item in items:
        target = f"{item['schema']} {item['key']}"
        try:
            current, explicit = read_setting(item)
            ok = current == item["value"]
            print(f"{'MATCH' if ok else 'DIFF ':<5} {target}: {current} (wanted {item['value']}, {'custom' if explicit is not None else 'default'})")
            mismatches += not ok
        except ConfigError as exc:
            print(f"UNSUPPORTED {target}: {exc}")
            mismatches += 1
    return 2 if mismatches else 0

def doctor(_: argparse.Namespace) -> int:
    print("Fedora macOS-like diagnostics (read-only)")
    for name in ("XDG_CURRENT_DESKTOP", "XDG_SESSION_TYPE", "WAYLAND_DISPLAY"):
        print(f"{name}: {os.getenv(name, '<unset>')}")
    for executable, arguments in {
        "gnome-shell": ("--version",),
        "gsettings": ("get", "org.gnome.settings-daemon.plugins.power", "power-button-action"),
        "loginctl": ("list-inhibitors", "--no-pager"),
        "systemd-analyze": ("cat-config", "systemd/logind.conf"),
    }.items():
        if not shutil.which(executable):
            print(f"{executable}: unavailable")
            continue
        result = subprocess.run([executable, *arguments], text=True, capture_output=True, check=False)
        print(f"{executable} {' '.join(arguments)} (exit {result.returncode}):\n{(result.stdout or result.stderr)[:3500].strip()}")
    print("NOTE: desktop-specific low-level inhibitors may supersede HandlePowerKey in logind.conf.")
    return 0

def validate(_: argparse.Namespace) -> int:
    profiles = sorted((ROOT / "profiles").glob("*.json"))
    for profile in profiles:
        loaded = entries(profile.stem)
        print(f"VALID {profile.name}: {len(loaded)} settings")
    for module in sorted((ROOT / "modules").glob("*.json")):
        data = load_json(module)
        if not isinstance(data.get("settings"), list) or not data["settings"]:
            raise ConfigError(f"Bad module: {module}")
        print(f"VALID {module.name}")
    return 0

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    for action in ("apply", "status"):
        p = sub.add_parser(action)
        p.add_argument("--profile", default="default", help="profiles/<name>.json")
        p.add_argument("--module", action="append", default=[], help="extra module to apply; repeatable")
        p.add_argument("--power", choices=sorted(POWER), help="explicit GNOME short-press power behavior")
        if action == "apply":
            p.add_argument("--dry-run", action="store_true")
            p.add_argument("--force", action="store_true", help="overwrite explicitly customized keys")
    p = sub.add_parser("rollback")
    p.add_argument("--snapshot", help="explicit snapshot.json to roll back")
    p.add_argument("--force", action="store_true", help="overwrite edits made since install")
    sub.add_parser("doctor")
    sub.add_parser("validate")
    args = parser.parse_args(argv)
    try:
        return {"apply": apply, "status": status, "rollback": rollback,
                "doctor": doctor, "validate": validate}[args.action](args)
    except ConfigError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
