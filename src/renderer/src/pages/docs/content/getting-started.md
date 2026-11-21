# Getting started

> Install Builder Studio, run first-run setup, and create your first build.

## Requirements

| Need                                       | Why                                                                               | Required     |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ------------ |
| Windows 10/11 x64                          | The installer and the managed build engine are Windows x64                        | Yes          |
| A workspace folder                         | Where your builds, references and reviews are kept                                | Yes          |
| Minecraft Java 1.12–26.3 game files        | Block textures and models for the 3D view and previews (default target: 26.3)     | For textures |
| A schematics folder (usually Litematica's) | Where **Export** copies finished builds (`.litematic`, `.schem`, or `.schematic`) | For export   |
| Claude, Codex or Ollama                    | An AI assistant that drafts and revises builds                                    | No           |

## Install

1. Download `builder-studio-<version>-setup.exe` from the latest release.
2. Run it. It installs per user into `%LOCALAPPDATA%\Programs\builder-studio`, with no admin prompt, and
   adds a Start menu entry and a desktop shortcut named **Builder Studio**.
3. The installer is not code-signed, so Windows SmartScreen warns once: choose **More info → Run anyway**.

## First-run setup

The setup guide opens on first launch. Folder defaults need no changes, tools prepare automatically,
and AI can be skipped. Tools and Minecraft textures must be ready before setup finishes.
Run it again any time from **Settings → General → Setup guide**.
Your builds and settings are kept.

| Step            | What you do                                                                                                                                                | Where to change it later      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1. Welcome      | Overview                                                                                                                                                   | —                             |
| 2. Workspace    | Keep `%APPDATA%\builder-studio\workspace` or choose another folder. Assets, tool storage and cache have defaults too. You can also import existing builds. | Settings → General / Advanced |
| 3. Build tools  | Wait for automatic checks and preparation of Engine, Git, a preview browser and local build history                                                        | Settings → Build tools        |
| 4. Minecraft    | Check detected game files or choose a texture pack. Keep the default export folder or customize it. Worlds are optional.                                   | Settings → Minecraft          |
| 5. AI assistant | Pick Claude, Codex or Ollama and connect it                                                                                                                | Settings → AI assistant       |
| 6. Ready        | Required checks must pass before opening the app; AI can be added later                                                                                    | —                             |

### Build tools

| Tool            | Does                                   | Notes                                                                                                                 |
| --------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Build engine    | Generates and checks builds            | Included in the installer or downloaded for the app's exact version, checksum-verified, then tested before activation |
| Preview browser | Renders preview images and site pages  | An installed Microsoft Edge is used first; otherwise a headless Chromium is downloaded into managed storage           |
| Git             | Keeps a history of every build version | An installed Git is used first; otherwise a portable MinGit is installed                                              |

A failed or canceled install keeps the tools that already worked. See
[Settings reference → Build tools](settings.md#build-tools) for repair and rollback.

### Minecraft

- **Game files**: leave empty to search the vanilla and Modrinth launchers. Builder Studio builds a
  texture pack from your own jar. No Mojang textures ship with the app.
- **Texture pack**: optional; use a resource pack ZIP instead.
- **Exported schematics folder**: defaults to `%APPDATA%\builder-studio\schematics`.
  Choose `.minecraft\schematics` if you want exports directly in Litematica's folder.
- **Worlds folder**: optional; lets **Build location** list your saves.

### AI assistant

- **Claude** needs your own Anthropic API key from the Anthropic Console; paste it and **Save key**.
  To use a Claude subscription instead, connect Claude Code or Claude Desktop over
  [MCP](external-agents.md).
- **Codex** signs in with **Sign in with ChatGPT**, which opens your browser.
- **Ollama** uses a server you already run and a model you already installed. Builder Studio never
  downloads models.

Details: [AI assistant](ai-assistant.md).

## Your first build

1. In the **Gallery**, choose **New build** and enter a name: lowercase letters, digits and
   underscores, starting with a letter (for example `stone_bridge`). This needs the build engine and Git.
2. The engine creates its starter scaffold in `builds/<name>/` and the build opens.
3. Press **Ctrl Enter** (or **⋯ → Generate draft**) to build a draft and see it in 3D.
4. Open the AI assistant with **Ctrl J** and describe what you want, or edit `builds/<name>/build.py`
   yourself. Builder Studio picks up file changes automatically.
5. When a version looks right, use **Review** to compare and give feedback, and **Export** to
   finalize it into your schematics folder.

Next: [Building and viewing](building.md).

## Updates

Installed copies check for a new release on launch, download it in the background, then show
**Restart to update** (a toast, and **Settings → General → Updates**). If you don't restart, the update
installs the next time you quit. **Check now** checks on demand. Development runs never check.
