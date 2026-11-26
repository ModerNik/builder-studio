# Review, design log and export

> How to compare versions and give feedback, read the build's history, and ship a finished build
> into your game.

## Review

Open it with **Review** in a build's header, or let the assistant open it with its `request_review`
tool. Review is where you tell the assistant (or yourself) what works and what doesn't.

- Up to **4 versions** side by side, each with its own view and its paste position.
- **Pick** the version you prefer.
- **Approve parts** chips: mark named parts that are done, so the next drafts keep them.
- **Pins**: click a block to drop a numbered pin with a note. A block pin records the cell (in the
  file's own coordinates), the block state and the camera view. Pins on a preview sheet record the
  pixel.
- **Notes**: free text for the whole review.

### Saving a review

**Save and send** writes `builds/<name>/review/round_N.json` and appends a short `### Round N` gist to
the end of the DESIGN.md log. If the assistant asked for the review, it receives the review and
continues.

With no assistant waiting, the button reads **Save review**. The toast offers to copy the line
`feedback in the app: <path>` so you can paste it into any chat; the build workflow reads the newest
round file either way.

### round_N.json

| Field                    | Content                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `round`, `build`, `date` | Review number, build name, `YYYY-MM-DD`                                                                                                        |
| `question`               | What the review asked                                                                                                                          |
| `files[]`                | Each version shown: `name` (stem), `path` (`builds/<name>/out/<stem>.litematic`), `paste` (world position of its min corner, or null), `sheet` |
| `pick`                   | The picked file's `name`, or null for none of them                                                                                             |
| `approved`               | Part names approved this review                                                                                                                |
| `pins`                   | Numbered pins on blocks or sheet pixels, each with a note                                                                                      |
| `notes`                  | Free text                                                                                                                                      |

The schema is `ReviewRoundSchema` in `src/shared/api.ts`.

## Design log

**Log** in a build's screen tabs (`Ctrl 7`, `/build/<name>/log`) renders `DESIGN.md`:

- The `## Status` block pinned at the top.
- The reviews as a timeline with their sheets; click one to jump to it.
- **Edit** opens the raw file. Saving writes the whole file, but refuses a change to the Status block,
  and refuses if the file changed on disk since you opened it.

## Export

**Export** (`/build/<name>/ship`, internally _ship_) is a checklist that takes the selected build from
draft to your schematics folder. Each line is one job or engine call, run top to bottom.

| #   | Step                    | What happens                                                                                                                                        |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Connect and check setup | Starts the engine bridge and checks the tools                                                                                                       |
| 2   | Lint zero               | Runs the `check` job against enabled lint rules; skipped automatically when the linter (or all rules) is off                                        |
| 3   | Full build              | Builds and finalizes into a staging folder under the cache (`<cache>/ship/<build>-<time>/`), not the game                                           |
| 4   | Hollow count            | Hidden interior blocks removed                                                                                                                      |
| 5   | Bill of materials       | Block counts, with rare blocks flagged                                                                                                              |
| 6   | Reload check            | The bridge reads the file back: same bill total and shape                                                                                           |
| 7   | Finalize                | Asks first, then copies the staged file into the schematics folder                                                                                  |
| 8   | Results table           | Written into the DESIGN.md log (always, even in a dry run)                                                                                          |
| 9   | Git commit              | Shows `git status` of `builds/<name>` in its confirm, then stages and commits that folder only. Nothing is pushed                                   |
| 10  | Rejected variants       | The unpicked files of the newest review with a pick: each `.litematic` with its `_3d/` and `_ctx/` renders goes to the Recycle Bin, after a confirm |

**Dry run** is on by default: Finalize copies into `<cache>/ship/dry-final/` instead of the game, and
Git commit only shows `git status`. Turn it off for a real export.

Finalize needs **Exported schematics folder** set in **Settings → Minecraft**.
It saves a legacy `.schematic` for Minecraft 1.12.x, a Sponge `.schem` for 1.13.x,
or a `.litematic` for later releases. The build’s Minecraft target determines the export.
