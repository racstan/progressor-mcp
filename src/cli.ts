#!/usr/bin/env node
// `progressor-mcp` runs the MCP server on stdio. `progressor-mcp hook <event>` is the Claude Code
// hook: it reads the hook's JSON on stdin, prints text for the Agent's context and exits. The server
// is loaded only when needed, so the hook (which runs on every prompt) starts fast.
if (process.argv[2] === "hook") {
  const { runHook } = await import("./hooks.js");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const out = runHook({ event: process.argv[3], input, env: process.env });
  if (out) process.stdout.write(`${out}\n`);
} else {
  await import("./serve.js");
}
