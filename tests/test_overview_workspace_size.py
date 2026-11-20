import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class OverviewWorkspaceSizeTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node.js is needed for the Shell API mock")
    def test_scale_relayout_and_restore(self):
        extension = ROOT / "integrations/overview-workspace-size/overview-workspace-size@fedora-mac-like-config/extension.js"
        result = subprocess.run(
            ["node", str(ROOT / "tests/js/overview-workspace-size.cjs"), str(extension)],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
