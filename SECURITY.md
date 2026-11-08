# Security

## Reporting a security problem

Please report security problems privately, so they can be fixed before anyone else learns about them:

1. Open the [**Security** tab](https://github.com/racstan/progressor-mcp/security) of this repository.
2. Choose **Report a vulnerability** and describe what you found, with the steps to reproduce it if you can.

Only the maintainer sees the report. You'll get a reply there, usually within a few days, and credit in the changelog when the fix is released if you'd like it.

Please don't report security problems in public issues. Everything else (bugs, setup trouble, ideas) is welcome in [GitHub issues](https://github.com/racstan/progressor-mcp/issues).

## Supported versions

Fixes go into the latest release. Update with `npm install -g progressor-mcp@latest`, or `docker pull ghcr.io/racstan/progressor-mcp:latest` for the Docker image.

## What Progressor does with your data

Progressor runs on your own computer. The plan is kept in your project's `.progressor/` folder, and the dashboard listens on localhost only (inside Docker, on the container's address, which you publish to `127.0.0.1`). It sends nothing anywhere unless you set up phone notifications through ntfy, which sends only the notification text to the ntfy server you choose.
