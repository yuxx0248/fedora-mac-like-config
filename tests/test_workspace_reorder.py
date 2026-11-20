import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class WorkspaceReorderTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node.js is needed for the Shell API mock")
    def test_drag_targets_and_cleanup(self):
        extension = ROOT / "integrations/workspace-reorder/workspace-reorder@fedora-mac-like-config/extension.js"
        result = subprocess.run(
            ["node", str(ROOT / "tests/js/workspace-reorder.cjs"), str(extension)],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
