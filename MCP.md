# MCP servers

This project ships a project-scoped MCP configuration in `.mcp.json`.

## aeronord

| | |
|---|---|
| Transport | HTTP |
| URL | `https://aircondic.grok.me/mcp` |
| Auth | `Authorization: Bearer $AERONORD_MCP_TOKEN` |

The token is **not** stored in the repository — `.mcp.json` references the
`AERONORD_MCP_TOKEN` environment variable, which Claude Code expands at load
time.

### Setup

```sh
cp .env.example .env      # then fill in AERONORD_MCP_TOKEN
# or, per shell session:
export AERONORD_MCP_TOKEN='...'
```

Start Claude Code from the project root and approve the server when prompted
(project-scoped servers require a one-time approval per user). Verify with
`/mcp`, or `claude mcp list`.

If the variable is unset, the server fails to authenticate and its tools will
not be available.
