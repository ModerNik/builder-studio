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

**Log** in a build's screen tabs (`Ctrl 6`, `/build/<name>/log`) renders `DESIGN.md`:

- The `## Status` block pinned at the top.
- The reviews as a timeline with their sheets; click one to jump to it.
- **Edit** opens the raw file. Saving writes the whole file, but refuses a change to the Status block,
  and refuses if the file changed on disk since you opened it.

## Export

**Export** (`Ctrl 7`, `/build/<name>/ship`, internally _ship_) sits at the end of the build tabs and
runs the full export automatically from a single **Export build** button.

Before exporting, you can choose:

- **Export format:** adapts to the build's target Minecraft version — `.litematic` (Litematica,
  1.14+), `.schem` (Sponge / WorldEdit / Axiom, 1.13+), `.nbt` (Minecraft Structure Block, 1.13+),
  or `.schematic` (Legacy MCEdit / WorldEdit, 1.12.x).
- **Destination folder:** defaults to **Exported schematics folder** in **Settings → Minecraft**,
  with a **Change…** button to export to another folder for the session (and **Reset to default** to
  restore it).

Clicking **Export build** runs six automatic stages in order; click any stage to inspect its logs or
details:

| Stage                     | What happens                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Check setup               | Verifies the engine runtime and destination folder                                                      |
| Lint check (advisory)     | Runs enabled lint rules as non-blocking suggestions; warnings never stop export                         |
| Build schematic           | Runs the full build and packages the chosen format into a temporary staging folder                      |
| Verify export             | Reads the packaged schematic back through the engine bridge to confirm block count and dimensions       |
| Save to folder            | Copies the verified schematic into the chosen destination folder                                        |
| Update DESIGN.md & commit | Appends the export summary table to `DESIGN.md` and commits `builds/<name>` locally if anything changed |

Once finished, **Show in folder** opens the exported file in your file manager.
