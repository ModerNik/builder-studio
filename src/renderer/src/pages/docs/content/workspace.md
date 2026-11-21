# Workspace and files

> Where Builder Studio keeps your builds, what each file is for, and how Git history works.

## Files are the source of truth

Builder Studio has no database. Everything it shows comes from plain files in your workspace, and a
file watcher refreshes the app when they change. That means you, the in-app assistant, and an
external agent such as Claude Code in its own terminal can all work on the same build at once
(**companion mode**): the app watches the files while the agent edits them.

App settings are separate, in `%APPDATA%\builder-studio\settings.json` (see
[Settings reference](settings.md)).

## Workspace layout

```
<workspace>/
  .git/                       created by Builder Studio when Git is available
  assets/                     prefab library (Labs → Prefabs); not tracked by Git
  builds/
    <name>/                   one build
    _examples/<name>/         folders starting with _ group more builds one level down
    _archive/<name>/          deleted builds (sources and DESIGN.md kept)
```

A folder under `builds/` counts as a build when it contains `build.py` or `DESIGN.md`. The Gallery
sorts builds by their newest version or preview sheet.

## A build's files

```
builds/<name>/
  build.py                    the generator script the engine runs
  DESIGN.md                   brief, status, round log and results (see below)
  minecraft.json              project Minecraft version target (optional; defaults to 26.3)
  data/edits.json             hand edits applied in the Editor (optional)
  data/terrain.npz            terrain written by Build location (optional)
  data/schematics/            imported source files, normalized blocks and placement metadata
  refs/                       reference board: images plus index.json
  review/round_N.json         one saved review round each
  out/                        generated output; not tracked by Git
    <stem>.litematic          a version (draft or full build)
    <stem>.parts.npz          named parts of that version, when the script uses c.op
    <stem>_3d/sheet.png       render sheet of that version
    <stem>_ctx/sheet.png      render sheet in context
    .diff/<a>__<b>/           Diff overlays
    .parts/<stem>/            Highlight and Isolate overlays
```

Every `.litematic` in `out/` is a **version** of the build; the newest is selected by default.

Each build also has a **Minecraft version** in `minecraft.json`. Choose it when creating a
project and use the Workspace menu to upgrade it. Builder Studio checks the generator and imported
blocks before saving the upgrade. New drafts and exports use the new target. Existing drafts keep
their Minecraft version, and projects created before this setting use 26.3.

### What the app writes

| File                             | Written by                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `DESIGN.md` `## 1. Brief (date)` | The **Brief** form in the Agent panel                                         |
| `DESIGN.md` `### Round N` gists  | **Review → Save and send**, and the assistant's `log_round` tool (asks first) |
| `DESIGN.md` results table        | The **Export** checklist                                                      |
| `review/round_N.json`            | **Review**                                                                    |
| `refs/`                          | The **References** board                                                      |
| `minecraft.json`                 | **New build** and **⋯ → Upgrade target…**                                     |
| `data/edits.json`                | The **Editor** (hand block edits)                                             |
| `data/terrain.npz`               | **Build location → Write terrain.npz** (confirms before overwriting)          |
| `data/schematics/`               | **New build → Start from a schematic** and **Import schematic…**              |
| `out/`                           | Build jobs run by the engine                                                  |

### DESIGN.md

`DESIGN.md` is the build's notebook: the brief, a `## Status` block, and a log of review rounds
(`### Round N: title`). The **Design log** screen renders it.

The `## Status` block belongs to the assistant. The app never edits it, and every DESIGN.md write
checks that Status came through unchanged. **Approve round** asks the assistant to update Status
instead. A manual **Edit** in the Design log saves the whole file but refuses a change to Status, or a
file that changed on disk since you opened it.

## Deleting a build

**Delete** in the Gallery keeps the knowledge: `build.py`, `DESIGN.md` and the other sources move to
`builds/_archive/<name>/`, so they stay in Git history. Only `out/` (drafts and renders) goes to the
Recycle Bin. Full builds already exported to the game's schematics folder are not touched.

**⋯ → Delete selected version…** in a build sends one version to the Recycle Bin.

## Git

When Git is available, choosing a workspace, importing, or creating a build initializes a repository
if there is none. Builder Studio:

- never resets a repository, inherits a parent repository, or changes your global Git identity;
- adds its exclusions to `.git/info/exclude`, not your `.gitignore`, so `out/`, caches, `.venv/`,
  `assets/`, `.claude/`, `.codex/` and `.env*` stay untracked;
- commits only one build folder at a time, after showing `git status` and an editable message
  (**Approve round**, **Export → Git commit**), and never pushes.

**Settings → Build tools** can fill a missing workspace-local commit identity (name and email). Global
configuration and credentials are left alone. **Initialize workspace Git** retries setup after Git is
installed.

## Importing builds from another folder

**Settings → General → Import builds** copies builds from an older checkout into your workspace.

1. Choose the source folder and the destination workspace. Assets are included by default.
2. Review the preview: file count, size, free space and any absolute paths that may need fixing.
3. Copy. The source stays intact and existing destination files are never overwritten.

Imports keep builds, archives, data, reviews, references and outputs. They leave out checkout code,
Python environments, credentials and Git or agent history. The destination drive needs hard-link
support (for example NTFS). A failed or canceled import rolls back its own files, and
**Recover interrupted import** finishes or cleans up an import that was cut off.

## Changing the workspace

Change it in **Settings → General → Workspace folder**. Jobs, reviews and assistant or variant
sessions must finish or close first. Switching restarts the file watcher and the engine bridge and
clears workspace state and the per-build **Always** permission rules.
