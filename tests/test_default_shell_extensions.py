import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/default-shell-extensions.sh"


class DefaultShellExtensionsTests(unittest.TestCase):
    def test_preserves_existing_and_explicitly_disabled_extensions(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            bindir, data = base / "bin", base / "data"
            bindir.mkdir()
            (data / "gnome-shell/extensions/fullscreen-top-bar@fedora-mac-like-config").mkdir(parents=True)
            log = base / "calls"
            commands = {
                "gnome-shell": "printf 'GNOME Shell 51.0\\n'",
                "gnome-extensions": '''case "$1" in
                    info) exit 1 ;;
                    pack) name=${2##*/}; shift 2; shift; : > "$1/$name.shell-extension.zip" ;;
                    install) printf '%s\\n' "${2##*/}" >> "$FML_TEST_LOG" ;;
                    *) exit 1 ;;
                esac''',
                "gjs": '''case "$2:$3" in
                    *disabled-extensions*:fullscreen-workspace@*) exit 1 ;;
                    *) exit 0 ;;
                esac''',
            }
            for name, body in commands.items():
                executable = bindir / name
                executable.write_text("#!/bin/sh\nset -eu\n" + body + "\n", encoding="utf-8")
                executable.chmod(0o755)
            env = dict(os.environ, PATH=f"{bindir}:/usr/bin:/bin", XDG_DATA_HOME=str(data), FML_TEST_LOG=str(log))
            preview = subprocess.run([str(SCRIPT), "--dry-run"], env=env, capture_output=True, text=True)
            self.assertEqual(preview.returncode, 0, preview.stderr)
            self.assertIn("WOULD INSTALL overview-workspace-size", preview.stdout)
            self.assertFalse(log.exists())
            result = subprocess.run([str(SCRIPT)], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("PRESERVED existing extension fullscreen-top-bar", result.stdout)
            self.assertIn("PRESERVED disabled extension fullscreen-workspace", result.stdout)
            self.assertEqual(log.read_text().splitlines(), ["overview-workspace-size@fedora-mac-like-config.shell-extension.zip"])


if __name__ == "__main__":
    unittest.main()
