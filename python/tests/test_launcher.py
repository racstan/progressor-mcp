"""Tests for the Python launcher. Run with: python -m unittest discover -s python/tests"""

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import progressor_mcp as launcher  # noqa: E402


class InstallKind(unittest.TestCase):
    def test_uvx_runs_from_uv_cache(self):
        self.assertEqual(launcher.install_kind(r"C:\Users\me\AppData\Local\uv\cache\archive-v0\Ab12Cd"), "uvx")
        self.assertEqual(launcher.install_kind("/home/me/.cache/uv/archive-v0/Ab12Cd"), "uvx")

    def test_uv_tool_install(self):
        self.assertEqual(launcher.install_kind(r"C:\Users\me\AppData\Roaming\uv\tools\progressor-mcp"), "uv-tool")
        self.assertEqual(launcher.install_kind("/home/me/.local/share/uv/tools/progressor-mcp"), "uv-tool")

    def test_anything_else_is_pip(self):
        self.assertEqual(launcher.install_kind("/home/me/project/.venv"), "pip")
        self.assertEqual(launcher.install_kind(r"C:\Python312"), "pip")


class Command(unittest.TestCase):
    def test_runs_the_bundled_cli_with_the_arguments(self):
        args, env = launcher.command(["hook", "UserPromptSubmit"], {}, prefix="/home/me/.venv", node="/opt/node")
        self.assertEqual(args, ["/opt/node", str(launcher.CLI), "hook", "UserPromptSubmit"])
        self.assertEqual(env["PROGRESSOR_INSTALL"], "pip")

    def test_keeps_the_rest_of_the_environment(self):
        _, env = launcher.command([], {"HOME": "/home/me"}, prefix="/home/me/.cache/uv/archive-v0/x", node="/opt/node")
        self.assertEqual(env["HOME"], "/home/me")
        self.assertEqual(env["PROGRESSOR_INSTALL"], "uvx")

    def test_progressor_node_overrides_the_bundled_node(self):
        args, _ = launcher.command([], {"PROGRESSOR_NODE": "/usr/bin/node"}, prefix="/x")
        self.assertEqual(args[0], "/usr/bin/node")

    def test_bundled_node_path(self):
        root = os.path.join("site", "nodejs_wheel")
        self.assertEqual(launcher.bundled_node(root, "nt"), os.path.join(root, "node.exe"))
        self.assertEqual(launcher.bundled_node(root, "posix"), os.path.join(root, "bin", "node"))


if __name__ == "__main__":
    unittest.main()
