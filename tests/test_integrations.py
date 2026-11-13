import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTEGRATION = ROOT / "integrations" / "power-blank"
PAYLOADS = (
    "fml-power-blank",
    "fml-kbd-backlight-watcher",
    "fml-power-blank.service",
    "fml-kbd-backlight-watcher.service",
)
MARKER = "managed by fedora-mac-like-config"


class IntegrationTests(unittest.TestCase):
    def test_payloads_exist_and_are_managed(self):
        for name in PAYLOADS:
            path = INTEGRATION / name
            self.assertTrue(path.is_file(), f"missing payload: {name}")
            self.assertIn(MARKER, path.read_text(encoding="utf-8"), f"unmanaged payload: {name}")

    def test_units_reference_installed_binary_names(self):
        for name in PAYLOADS:
            if not name.endswith(".service"):
                continue
            text = (INTEGRATION / name).read_text(encoding="utf-8")
            self.assertIn("%h/.local/bin/fml-", text, f"{name} must exec the installed fml- binary")
            self.assertNotIn("sudo", text)

    def test_scripts_are_valid_bash(self):
        script = ROOT / "scripts" / "power-blank.sh"
        self.assertTrue(script.is_file())
        result = subprocess.run(["bash", "-n", str(script)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        result = subprocess.run(["bash", "-n", str(INTEGRATION / "fml-kbd-backlight-watcher")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_python_daemon_compiles(self):
        result = subprocess.run(
            ["python3", "-m", "py_compile", str(INTEGRATION / "fml-power-blank")],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
