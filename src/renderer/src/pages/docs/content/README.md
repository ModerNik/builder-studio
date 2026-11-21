# Builder Studio documentation

Builder Studio is a Windows desktop app for designing Minecraft builds with code and AI: it runs the
build engine on your PC, shows every version in a live 3D view, collects your review feedback, and
exports finished `.litematic` schematics into your game.

These pages are the full reference. Each one is self-contained plain Markdown, so an AI agent can read
a single page for one topic. They are also readable inside the app: **Settings → Advanced →
Documentation**.

## Pages

| Page                                                  | Covers                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Getting started](getting-started.md)                 | Install, first-run setup, what each setup step needs, updates                                 |
| [Workspace and files](workspace.md)                   | The workspace folder, a build's files, DESIGN.md, Git, importing old projects                 |
| [Building and viewing](building.md)                   | Gallery, the build workspace, 3D view, Preview, Compare, Diff, Parts, Checks, materials, keys |
| [Review, design log and export](review-and-export.md) | Review rounds, pins and picks, the Design log, the Export checklist                           |
| [Planning tools](planning-tools.md)                   | Build location (site picker), References board, Variants, Labs                                |
| [AI assistant](ai-assistant.md)                       | Claude Code, Codex and Ollama; the Agent panel, permissions, sessions, studio tools           |
| [External agents (MCP)](external-agents.md)           | The local MCP server and how to connect Claude Code, Codex or Claude Desktop                  |
| [Settings reference](settings.md)                     | Every Settings section, every `settings.json` key and its default                             |

## Key facts

- Workspace files are the source of truth. There is no database; the app reads and writes plain
  files under `<workspace>/builds/<name>/`.
- App settings live in `%APPDATA%\builder-studio\settings.json`.
- The build engine is a separate, verified Python distribution that the app installs and manages in
  its own folder. It never changes your system Python.
- AI is optional. Builds, previews, review and export all work without an assistant.
- The app never writes to a Minecraft world. It reads saves only through copies, and exports
  schematics only into the folder you choose.

---

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
