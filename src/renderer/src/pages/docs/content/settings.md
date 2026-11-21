# Settings reference

> Every Settings section, and every key in `settings.json` with its default.

Settings save automatically. A dot next to a section in the Settings rail means something there
still needs setup.

First-run setup creates the workspace, assets, exports, runtime and cache folders automatically.
Keep the defaults and continue, or customize them. Only the AI step can be skipped; tools, textures
and writable export storage must pass their checks before setup finishes. Existing settings and builds
are preserved when setup is run again.

## General

| Item             | Does                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme            | **Dark** (default), **Light**, or **System** to follow Windows' app mode                                                                                                               |
| Interface size   | Zoom the whole UI from 67% to 200% (`Ctrl −` / `Ctrl +` / `Ctrl 0`)                                                                                                                    |
| Workspace folder | **Open folder** in Explorer, or **Change…**. Changing it requires jobs, reviews and assistant sessions to be finished (see [Workspace and files](workspace.md#changing-the-workspace)) |
| Import builds    | Copy builds from another folder (see [Workspace and files](workspace.md#importing-builds-from-another-folder))                                                                         |
| Updates          | Current version and update state; **Check now** or **Restart to update**                                                                                                               |
| Licenses         | Open **Licenses and notices** (`THIRD_PARTY_NOTICES.txt`)                                                                                                                              |
| Setup guide      | **Run setup again**. Builds and settings are kept                                                                                                                                      |

## Minecraft

Leave a field empty to use what Builder Studio finds, shown in gray.

| Field                      | Default when empty                                                               | Needed for                                      |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| Default Minecraft version  | Suggested from installed Java releases on setup, or choose any supported version | New projects                                    |
| Game files                 | Searched by version in the vanilla and Modrinth launchers                        | Textured previews, unless a texture pack is set |
| Texture pack               | Generated from your own game files and cached per version and source             | Optional                                        |
| Exported schematics folder | `%APPDATA%\builder-studio\schematics`                                            | **Export → Finalize**                           |
| Worlds folder              | Detected saves folder, if any                                                    | **Build location**                              |

## AI assistant

The provider (Claude, Codex or Ollama), its status, the Anthropic API key for Claude (saved
encrypted, shown only as set or not set), Ollama's server address and model,
and **Variants drafted at once** (2–6, default 3). See [AI assistant](ai-assistant.md).

## External agents

The MCP server address and copyable setup snippets for Claude Code, Codex CLI and Claude Desktop. See
[External agents](external-agents.md).

## Build tools

Tools Builder Studio installs and manages in its own folder.

| Tool            | Does                                   | Actions                                       |
| --------------- | -------------------------------------- | --------------------------------------------- |
| Build engine    | Generates and checks builds            | **Install**, **Repair**, **Restore previous** |
| Preview browser | Renders preview images and site pages  | **Install** (Edge is used when installed)     |
| Git             | Keeps a history of every build version | **Install** (an installed Git is used first)  |

- **Install** and **Repair** use included archives or download the engine for the app's exact version,
  check its SHA-256 and length, extract it into a new folder, and test its imports and the engine
  bridge before switching to it. A failed or canceled install keeps the working version.
- **Repair** always creates a new folder; older versions are kept.
- **Restore previous** checks and reactivates the version that was active before.
- Setup preserves an existing Git identity and fills missing values locally with
  `Builder Studio User <user@builder-studio.invalid>`. The identity form intentionally changes the
  workspace's name and email; global Git configuration is never changed.
- **Initialize workspace Git** retries repository setup after Git is installed.

## Advanced

- **Documentation**: opens these pages inside the app.
- **Diagnostics**: every requirement checked again, with **Copy report** for support.
- **Custom program and folder locations**: manual overrides. Only change them if you were asked to;
  an empty field uses the detected location shown in gray.

| Field                | Default when empty                                                               |
| -------------------- | -------------------------------------------------------------------------------- |
| Claude Code program  | Detected `claude.exe` (usually `~/.local/bin/claude.exe`)                        |
| Codex program        | Found on PATH                                                                    |
| Git Bash program     | Found automatically                                                              |
| Python runtime       | `<active build tools>/python.exe`                                                |
| Build tools folder   | `%APPDATA%\builder-studio\runtime`                                               |
| Active build tools   | Filled in when tools are installed (`<build tools folder>/current`)              |
| Cache folder         | `%APPDATA%\builder-studio\cache`: packs, site maps, scene sheets, export staging |
| Assets folder        | `<workspace>/assets`                                                             |
| App resources folder | Bundled with the app (`<app resources>/engine/`)                                 |

Set **Build tools folder** before installing tools to keep them somewhere else.

## settings.json

Stored at `%APPDATA%\builder-studio\settings.json`. Relative paths resolve against the workspace.
Older settings files are migrated automatically and backed up to `settings.json.v1.bak`.

| Key                | Type                                                      | Default                                 | Meaning                                                                          |
| ------------------ | --------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `version`          | `2`                                                       | `2`                                     | Schema version                                                                   |
| `workspace`        | path                                                      | `""`                                    | The workspace folder                                                             |
| `setup`            | object                                                    | `{ step: "welcome", completed: false }` | First-run setup progress                                                         |
| `saves`            | path                                                      | `""`                                    | Worlds folder                                                                    |
| `resources`        | path                                                      | `""` (bundled)                          | Engine resources: workflow, catalogs, renderer assets                            |
| `runtime`          | path                                                      | `""`                                    | Active build tools folder                                                        |
| `runtimeHome`      | path                                                      | `""` (`<userData>/runtime`)             | Where managed tool versions are kept                                             |
| `previousRuntime`  | path                                                      | `""`                                    | Last working tools folder, for **Restore previous**                              |
| `browser`          | path                                                      | `""`                                    | Managed preview browser folder                                                   |
| `git`              | path                                                      | `""`                                    | Managed Git; an installed Git takes precedence                                   |
| `cache`            | path                                                      | `""` (`<userData>/cache`)               | Packs, temporary renders and export staging                                      |
| `assets`           | path                                                      | `""` (`<workspace>/assets`)             | Prefab library                                                                   |
| `importSource`     | path                                                      | `""`                                    | An older checkout offered as an import suggestion; never activated automatically |
| `python`           | path                                                      | `""` (`<runtime>/python.exe`)           | Python interpreter with the engine installed                                     |
| `schematics`       | path                                                      | `""`                                    | Export destination                                                               |
| `jar`              | path                                                      | `""`                                    | Minecraft client jar                                                             |
| `claude`           | path                                                      | `""` (detected)                         | `claude.exe`                                                                     |
| `provider`         | `"claude"` \| `"codex"` \| `"ollama"`                     | `"claude"`                              | AI assistant                                                                     |
| `codex`            | path                                                      | `""` (detected)                         | `codex.exe`                                                                      |
| `gitBash`          | path                                                      | `""` (detected)                         | Git Bash, needed by Claude Code on Windows                                       |
| `ollamaEndpoint`   | URL                                                       | `"http://127.0.0.1:11434"`              | Ollama server                                                                    |
| `ollamaModel`      | string                                                    | `""`                                    | An installed Ollama model                                                        |
| `minecraftVersion` | Java release ID                                           | `26.3`                                  | Default target for new projects                                                  |
| `minecraftFiles`   | Paths keyed by Java release ID                            | `{}`                                    | Game jar and texture pack overrides per version                                  |
| `pack`             | path                                                      | `""`                                    | Older 26.3 texture pack override                                                 |
| `agentAllow`       | `{ [build]: string[] }`                                   | `{}`                                    | Per-build **Always** permission rules, `Tool` or `Tool(prefix)`                  |
| `variantCap`       | 2–6                                                       | `3`                                     | Variant sessions at once                                                         |
| `appearance`       | `{ theme: "dark" \| "light" \| "system", scale: 0.67–2 }` | `{ theme: "dark", scale: 1 }`           | Color theme (`system` follows the OS) and UI zoom scale                          |

The schema is `SettingsSchema` in `src/shared/api.ts`.
