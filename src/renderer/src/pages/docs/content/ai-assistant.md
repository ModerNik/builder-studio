# AI assistant

> The embedded assistant: which AI providers work, how the Agent panel works, what it may do without
> asking, and the tools it gets inside Builder Studio.

AI is optional. Everything else in Builder Studio works without it.

## Providers

Choose one in **Settings → AI assistant** (or setup step 5).

| Provider   | Runs               | Sign-in                                              | Notes                                                                                                                                                                                             |
| ---------- | ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude** | Online (Anthropic) | Your own Anthropic API key, entered in Settings → AI | Default. Runs through the `claude` CLI                                                                                                                                                            |
| **Codex**  | Online (OpenAI)    | **Sign in with ChatGPT** opens your browser          | Uses the `codex` CLI                                                                                                                                                                              |
| **Ollama** | On your PC         | None                                                 | Runs through the Codex CLI against your Ollama server. Set **Server address** (default `http://127.0.0.1:11434`) and **Model**, an already-installed model. Builder Studio never downloads models |

Each provider card shows **Ready**, **API key needed**, **Sign-in needed** or **Not connected**, with
**Check again**.

To use a Claude Pro or Max subscription instead of an API key, keep Claude Code or Claude Desktop
outside the app and connect it over MCP ([External agents](external-agents.md)). Builder Studio never
offers a Claude.ai sign-in and never uses subscription credentials.

### Credentials and isolation

- **Claude** runs through the Agent SDK with your installed `claude` binary and your own Anthropic
  API key. The key is encrypted with the operating system's credential protection (DPAPI on Windows)
  in its own file, never in `settings.json`, never shown again and never logged. It reaches the
  assistant as `ANTHROPIC_API_KEY`; other Anthropic and Claude Code variables (tokens, `ANTHROPIC_BASE_URL`, Bedrock or Vertex switches) are removed from its environment. If the CLI still
  reports a subscription login instead of the key, the session ends with an error. Usage is billed to
  your Anthropic Console account. On Windows Claude also needs Git Bash (found automatically, or set
  in Advanced).
- **Codex and Ollama** run with an app-owned `CODEX_HOME` and command-line overrides only. Your
  global `~/.codex/config.toml` is never written. The sandbox is `workspace-write`: only the workspace
  and the cache are writable, network access is off, and web search is disabled.

## The Agent panel

The right-hand panel (**Chat**, the speech-bubble button, or **Ctrl J**) talks to an assistant about the open build. Its
working folder is the workspace. The bundled build workflow instructions and the render critic are
added alongside the workspace's own `CLAUDE.md`, skills and hooks.

### Composer

- **Enter** sends, **Shift Enter** adds a line.
- Type `/` (Claude) or `$` (Codex, Ollama) to pick a skill.
- Paste or attach images and files. **Attach refs** adds items from the build's References board.
- Selected parts from the Editor's Parts tab arrive as a chip and are sent with the next message.
- Pickers under the input: **permission mode**, **model** and **effort**. Changing them also changes
  the live session. Ollama has no effort setting and uses the model chosen in Settings.

### Permission modes

| Mode             | Behavior                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Manual**       | Asks before each edit and command                                                                                           |
| **Accept edits** | Runs edits and commands without asking                                                                                      |
| **Auto**         | Claude: a classifier approves calls for you and risky calls still ask. Codex and Ollama: never asks, bounded by the sandbox |
| **Plan**         | Plans first and asks before it edits. **Implement plan** switches the thread to **Auto** and starts the work                |

**Shift Tab** in the input cycles modes.

### Permission cards

The assistant asks before every tool call except reads and the studio tools below. Each ask is a card:

- **Allow**: this call only.
- **Always**: stores a rule such as `Bash(python builds/x/build.py check)` under `agentAllow.<build>` in
  `settings.json`. Bash rules match a command prefix and never a chained command (`;`, `&`, `|`, `<`,
  `>`, backticks, `$(` or a newline end the match).
- **Deny**.

Some calls ask every time and never offer **Always**: `git push`, deletes outside `builds/*/out/`, and
any path outside the workspace. Your own `~/.claude/settings.json` deny rules still apply. Changing
the workspace clears all Always rules.

### Transcript

Streamed text, a card per tool call (Edit and Write show a diff), a **job card** for every `build.py`
run the assistant makes (stage, lint, seconds, **Show** and **Sheet** buttons), and subagent calls as
cards with their own steps nested inside.

### Threads and sessions

- Several **threads** can work at once, on the same or different builds; up to 4 hold a live session,
  and a new one closes the oldest idle thread. A warning appears when two threads work on the same
  build, since their edits can collide.
- The thread picker lists this build's stored **sessions**. Open one to read and continue it,
  **Fork** it to try another direction, **Rename** it, or **Close** a thread (the session stays in the
  list). **+** starts a new thread.

### Meter

Status, context tokens (amber from 150k, red from 200k, with **Compact**), the
sign-in kind as the CLI reports it, and the session cost as the CLI reports it. A badge shows variant sessions working in parallel.

### Chat commands

Type `/` to filter commands. Enter runs the highlighted command. Tab completes its name so you can
add arguments. Claude skills appear in the same menu. Use `$` for Codex and Ollama skills.

| Command          | Action                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/clear`         | Start a fresh thread for the current build and keep the previous conversation in history.                                                                        |
| `/fork`          | Open a new thread with a copy of the current conversation.                                                                                                       |
| `/rewind`        | Select a turn and continue from just before it in a new thread. Choose **Conversation only** or review the affected paths and choose **Conversation and files**. |
| `/compact`       | Summarize the existing conversation to free context. Claude also accepts an optional focus after the command.                                                    |
| `/context`       | Show context usage and the provider’s breakdown when available.                                                                                                  |
| `/skills`        | Browse the current provider’s available skills.                                                                                                                  |
| `/mcp`           | Open the MCP server panel.                                                                                                                                       |
| `/resume`        | Open the thread and saved conversation picker.                                                                                                                   |
| `/rename [name]` | Name the current conversation. With no name, opens the rename dialog.                                                                                            |
| `/model`         | Open the model and effort menu. Choose the Ollama model in AI settings.                                                                                          |

File rewind uses checkpoints from up to eight recent turns captured while Builder Studio is open.
It covers regular source files inside the build folder, including changes made by shell tools during
those turns. Generated output, attachments, references, review files, hidden paths and links are
outside the checkpoint. Later edits to a file that would be restored block the file action. Chat
rewind remains available for older saved conversations.

### MCP servers

The plug icon lists the live status of each server from `<workspace>/.mcp.json`, plus the built-in
`studio` server, with an on/off switch where the provider supports it.

## Brief

One conversation per build is enough: ask, let the assistant plan (in **Plan** mode) and implement,
and keep going in the same thread. Start another thread only when you want a fresh context.

**Brief** (the page icon in the panel header, or **Write a brief** in an empty thread) writes your text
as `## 1. Brief (date)` in DESIGN.md (Status untouched), starts a new thread, and sends it as the first
message. Attach references here too. Commit a build's folder with **Export → Git commit**.

## Studio tools

The embedded assistant gets an in-process MCP server named `studio`:

| Tool                         | Does                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `show_in_viewer(path)`       | Opens a `.litematic` version in the workspace view                   |
| `show_sheet(path)`           | Shows a render sheet                                                 |
| `status()`                   | What's open: build, version, tab, picked block, review; running jobs |
| `request_review(...)`        | Opens Review and waits; returns the saved round when you send it     |
| `log_round(build, markdown)` | Appends a `### Round N` gist to DESIGN.md (asks first)               |

The localhost companion server for [external agents](external-agents.md) is a separate server and is
not given to the embedded assistant.

## Using an assistant outside the app

You can also keep Claude Code or Codex running in your own terminal in the workspace (companion mode)
and connect it to the app over MCP. See [External agents](external-agents.md).
