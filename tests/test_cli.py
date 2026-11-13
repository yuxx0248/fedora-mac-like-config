import unittest
from fedora_mac_like.cli import ConfigError, decision, entries, dconf_path


class ManifestTests(unittest.TestCase):
    def test_default_has_unique_settings(self):
        rows = entries("default")
        self.assertGreaterEqual(len(rows), 8)
        self.assertEqual(len({(r["schema"], r["key"]) for r in rows}), len(rows))

    def test_explicit_power(self):
        rows = entries("minimal", power="suspend")
        self.assertTrue(any(r["key"] == "power-button-action" and r["value"] == "'suspend'" for r in rows))

    def test_invalid_module_rejected(self):
        with self.assertRaises(ConfigError):
            entries("default", ["../etc/passwd"])

    def test_dconf_path(self):
        self.assertEqual(
            dconf_path({"schema": "org.gnome.desktop.peripherals.touchpad", "key": "tap-to-click"}),
            "/org/gnome/desktop/peripherals/touchpad/tap-to-click",
        )


class PlanningTests(unittest.TestCase):
    def test_preserve_explicit_values(self):
        self.assertEqual(decision("false", "false", "true", False), "preserved")
        self.assertEqual(decision("false", "false", "true", True), "apply")

    def test_inherited_defaults_are_safe_to_change(self):
        self.assertEqual(decision("false", None, "true", False), "apply")

    def test_already_equal_is_idempotent(self):
        self.assertEqual(decision("true", "true", "true", False), "already")


if __name__ == "__main__":
    unittest.main()
