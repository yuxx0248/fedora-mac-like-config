import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "tap-guard.sh"
DAEMON = ROOT / "integrations" / "tap-guard" / "fml-tap-guard"
UNIT = ROOT / "integrations" / "tap-guard" / "fml-tap-guard.service"
MARKER = "managed by fedora-mac-like-config"


class TapGuardDaemonTests(unittest.TestCase):
    def test_daemon_exists_and_is_managed(self):
        self.assertTrue(DAEMON.is_file(), f"missing daemon: {DAEMON}")
        self.assertIn(MARKER, DAEMON.read_text(encoding="utf-8"), "unmanaged daemon")

    def test_daemon_compiles_without_writing_pycache(self):
        result = subprocess.run(
            ["python3", "-c",
             "import sys; compile(open(sys.argv[1]).read(), sys.argv[1], 'exec')",
             str(DAEMON)],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_daemon_self_test_passes(self):
        result = subprocess.run([str(DAEMON), "--self-test"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("SELF-TEST PASS", result.stdout)

    def test_daemon_never_writes_pycache_for_self_test(self):
        pycache = DAEMON.parent / "__pycache__"
        if pycache.exists():
            for f in pycache.iterdir():
                f.unlink()
            pycache.rmdir()
        subprocess.run([str(DAEMON), "--self-test"], capture_output=True, text=True)
        self.assertFalse(pycache.exists(), "self-test must not leave __pycache__")

    def test_daemon_invariants(self):
        text = DAEMON.read_text(encoding="utf-8")
        # Modifiers must never arm the window (Ctrl+click keeps working).
        self.assertIn("MODIFIER_CODES", text)
        self.assertIn("is_typing_activity", text)
        # Baseline restore on shutdown, so the touchpad cannot stay disabled.
        self.assertIn("shutdown_restore", text)
        # GNOME surface used for the toggle.
        self.assertIn("org.gnome.desktop.peripherals.touchpad", text)
        self.assertIn("send-events", text)
        # Generic device matching, extended by --include.
        self.assertIn('KEYBOARD_PATTERNS = ("keyboard",)', text)
        self.assertIn("--include", text)
        # Default window 1.0s (covers the brief-tap band, minimal dead time).
        self.assertIn("default=1.0", text)

    def test_daemon_rejects_tiny_idle_window(self):
        result = subprocess.run([str(DAEMON), "--idle-secs", "0.1", "--dry-run"],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("--idle-secs must be >= 0.5", result.stderr)


class TapGuardServiceTests(unittest.TestCase):
    def test_unit_exists_and_is_managed(self):
        self.assertTrue(UNIT.is_file(), f"missing unit: {UNIT}")
        self.assertIn(MARKER, UNIT.read_text(encoding="utf-8"), "unmanaged unit")

    def test_unit_invariants(self):
        text = UNIT.read_text(encoding="utf-8")
        self.assertIn("Description=fml tap-guard: suppress touchpad briefly after typing", text)
        self.assertIn("ExecStart=%h/.local/share/fedora-mac-like-config/integrations/tap-guard/fml-tap-guard", text)
        self.assertIn("After=graphical-session.target", text)
        self.assertIn("PartOf=graphical-session.target", text)
        self.assertIn("WantedBy=graphical-session.target", text)
        self.assertIn("Restart=on-failure", text)
        # User-level service: no root, no system paths.
        self.assertNotIn("/usr/local", text)
        self.assertNotIn("/etc/", text)


class TapGuardScriptTests(unittest.TestCase):
    def test_script_is_valid_bash(self):
        result = subprocess.run(["bash", "-n", str(SCRIPT)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_script_rejects_unmanaged_files_and_bad_usage(self):
        text = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("Refusing to overwrite unmanaged file", text)
        self.assertIn("Refusing to remove unmanaged file", text)
        result = subprocess.run([str(SCRIPT)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("Usage:", result.stderr)

    def test_script_is_user_level(self):
        text = SCRIPT.read_text(encoding="utf-8")
        # No implicit sudo: everything lands under the user's home.
        self.assertNotIn("exec sudo", text)
        self.assertIn("systemctl --user", text)
        self.assertIn("usermod -aG input", text)  # documented one-time requirement

    def test_docs_reference_the_integration(self):
        keymap = (ROOT / "docs" / "keymap.md").read_text(encoding="utf-8")
        self.assertIn("tap-guard", keymap.lower())
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("tap-guard", readme.lower())


if __name__ == "__main__":
    unittest.main()
