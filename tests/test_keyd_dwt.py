import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "keyd-dwt.sh"
RULE = ROOT / "integrations" / "keyd-dwt" / "99-keyd-internal-keyboard.rules"
MARKER = "managed by fedora-mac-like-config"


class KeydDwtTests(unittest.TestCase):
    def test_rule_exists_and_is_managed(self):
        self.assertTrue(RULE.is_file(), f"missing rule: {RULE}")
        self.assertIn(MARKER, RULE.read_text(encoding="utf-8"), "unmanaged rule")

    def test_rule_marks_keyd_keyboards_internal_without_executing(self):
        text = RULE.read_text(encoding="utf-8")
        self.assertIn('SUBSYSTEM=="input"', text)
        self.assertIn('ATTRS{name}=="*keyd virtual keyboard"', text)
        self.assertIn('ENV{LIBINPUT_ATTR_KEYBOARD_INTEGRATION}="internal"', text)
        # A pure tagging rule: never spawns helpers or mutates devices.
        for forbidden in ("RUN+=", "PROGRAM=", "ACTION==", "OPTIONS="):
            self.assertNotIn(forbidden, text, f"rule must stay a pure ENV tag, found {forbidden}")

    def test_script_is_valid_bash(self):
        self.assertTrue(SCRIPT.is_file())
        result = subprocess.run(["bash", "-n", str(SCRIPT)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_script_rejects_unmanaged_files_and_bad_usage(self):
        text = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("Refusing to overwrite unmanaged file", text)
        self.assertIn("Refusing to remove unmanaged file", text)
        result = subprocess.run([str(SCRIPT)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("Usage:", result.stderr)


if __name__ == "__main__":
    unittest.main()
