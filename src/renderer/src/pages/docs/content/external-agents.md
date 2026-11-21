# External agents (MCP)

> Connect an AI agent running outside Builder Studio, such as Claude Code in a terminal, Codex CLI or
> Claude Desktop, so it can open builds in the app and ask you to review them.

This is also how to use a Claude Pro or Max subscription with Builder Studio: the embedded assistant
runs only on your own Anthropic API key, while Claude Code or Claude Desktop, signed in with your
subscription, connects here as an external agent.

## The server

While Builder Studio runs, it serves MCP over Streamable HTTP at:

```
http://127.0.0.1:7341/mcp
```

It listens on loopback only. It refuses any `Host` header other than `127.0.0.1:7341` and
`localhost:7341`, and any request that carries an `Origin` header, so web pages can't reach it. Only
programs on this PC can connect.

The server's MCP instructions tell a connecting agent to call `guide` first.

## Tools

| Tool | Does |
|---|---|
| `guide()` | Returns the workspace and runtime paths, the Python command, and the bundled build workflow (the embedded assistant's instructions) |
| `show(path)` | Opens `builds/<name>/out/<file>.litematic` in the app |
| `sheet(path)` | Shows a render sheet `builds/<name>/out/…/<file>.png` in the app |
| `status()` | What's open (build, version, tab, picked block, review), running jobs, reviews waiting |
| `request_review(build, question, variants[], parts?)` | Opens the Review screen and waits; returns the saved `round_N.json`, or `declined` |

## Connect a client

Builder Studio doesn't register the server anywhere for you. **Settings → External agents** shows the
same snippets with copy buttons.

### Claude Code

Run from the workspace:

```bash
claude mcp add --transport http builder-studio http://127.0.0.1:7341/mcp
```

### Codex CLI

```bash
codex mcp add builder-studio --url http://127.0.0.1:7341/mcp
```

Then let `request_review` wait for you, in `~/.codex/config.toml`:

```toml
[mcp_servers.builder-studio]
url = "http://127.0.0.1:7341/mcp"
tool_timeout_sec = 86400
```

### Claude Desktop

Claude Desktop only launches local (stdio) servers from its config, and its Connectors can't reach
localhost, so bridge with `mcp-remote`. Add this to `%APPDATA%\Claude\claude_desktop_config.json`
(needs Node), then restart Claude Desktop:

```json
{
  "mcpServers": {
    "builder-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://127.0.0.1:7341/mcp"]
    }
  }
}
```

## Waiting for a review

`request_review` waits as long as you take and sends a progress ping every 20 seconds. If the client
still gives up first, raise its tool timeout (Claude Code: start it with a larger `MCP_TOOL_TIMEOUT`,
in milliseconds; Codex: `tool_timeout_sec` above).

Without MCP, use **Save round** in Review and paste the copied `feedback in the app: <path>` line into
the chat. The build workflow reads the newest round file either way.
