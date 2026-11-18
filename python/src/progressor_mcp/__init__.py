"""Runs Progressor from Python.

Progressor is written in TypeScript. This package carries the same built Progressor that is on npm
(in app/) and runs it with the Node that the nodejs-wheel-binaries package installs, so nobody needs
Node installed for `uvx progressor-mcp` or `pip install progressor-mcp` to work. Every argument is
passed through: `progressor-mcp init`, `progressor-mcp dashboard` and the rest work as with npm.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path
from typing import List, Mapping, Optional, Sequence, Tuple

APP = Path(__file__).resolve().parent / "app"
CLI = APP / "dist" / "cli.js"


def install_kind(prefix: str) -> str:
    """How this copy was installed, from the Python environment it runs in.

    Progressor uses it to write the right command into an AI app's settings (uvx progressor-mcp) and
    to say how to update. uvx runs from uv's cache (AppData/Local/uv/cache/archive-v0/... on Windows,
    ~/.cache/uv/archive-v0/... elsewhere), `uv tool install` from uv's tools folder, and anything
    else is taken as pip.
    """
    path = prefix.replace("\\", "/").lower()
    if re.search(r"/uv/(cache/)?archive-v\d+/", path + "/"):
        return "uvx"
    if re.search(r"/uv/(data/)?tools/", path + "/"):
        return "uv-tool"
    return "pip"


def bundled_node(root: str, os_name: str = os.name) -> str:
    """Where nodejs-wheel-binaries keeps Node: beside its code on Windows, in bin/ elsewhere."""
    return os.path.join(root, "node.exe") if os_name == "nt" else os.path.join(root, "bin", "node")


def _node_from_wheel() -> str:
    from nodejs_wheel.executable import ROOT_DIR

    return bundled_node(ROOT_DIR)


def command(
    argv: Sequence[str], env: Mapping[str, str], prefix: str = sys.prefix, node: Optional[str] = None
) -> Tuple[List[str], dict]:
    """The Node command line and environment that run Progressor with these arguments.

    PROGRESSOR_NODE, if set, picks another Node (22 or later) instead of the bundled one.
    """
    out = dict(env)
    out.setdefault("PROGRESSOR_INSTALL", install_kind(prefix))
    program = out.get("PROGRESSOR_NODE") or node or _node_from_wheel()
    return [program, str(CLI), *argv], out


def main() -> None:
    if not CLI.exists():
        sys.exit(f"progressor: this package is missing Progressor itself ({CLI}). Reinstall progressor-mcp.")
    args, env = command(sys.argv[1:], os.environ)
    if os.name != "nt":
        # Replace this process, so signals and the MCP client's stdin/stdout go straight to Node.
        os.execve(args[0], args, env)
    # Windows has no exec that keeps the same process, so run Node and pass its exit code on.
    # Ctrl+C reaches Node too, which stops by itself; this side only waits for it.
    process = subprocess.Popen(args, env=env)
    while True:
        try:
            sys.exit(process.wait())
        except KeyboardInterrupt:
            continue
