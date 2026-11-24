# Building and viewing

> The Gallery, the build workspace, the 3D view and its inspection tools, and keyboard shortcuts.

## Gallery

The home screen lists every build in the workspace with its newest preview sheet, sorted by the
most recent change.

- **New build** creates the engine's starter scaffold in `builds/<name>/` and opens it. Names use
  lowercase letters, digits and underscores, start with a letter, and can't be reserved Windows names
  such as `con` or `nul`. Needs the build engine and Git.
- To start from an existing schematic, choose **Start from a schematic** in **New build**. The
  project opens with the imported blocks as its first version.
- **Delete** archives the build's sources to `builds/_archive/` and sends only `out/` to the Recycle
  Bin (see [Workspace and files](workspace.md#deleting-a-build)).
- **Ctrl K** opens the command palette to jump to any build or screen.

## The build workspace

Opening a build (`/build/<name>`) shows its versions, a large 3D view and the **Editor** panel. The
screen tabs (Workspace, Review, Variants, Export, Location, Refs, Log) open the build's other screens,
and the **Editor**, **Chat** and **Activity** (`Ctrl \``) buttons beside them show and hide those
panels.

### Header

| Control                          | Does                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Version picker                   | Chooses which `.litematic` in `out/` is shown. The newest is selected by default                                               |
| **3D / Preview / Compare** icons | The view mode (keys `1`–`4`); hover one for its name                                                                           |
| **Perspective** (pyramid icon)   | Shown in 3D: switches from the isometric default                                                                               |
| **⋯** menu                       | **Upgrade target…**, **Generate draft** (Ctrl Enter), **Draft settings…**, **Import schematic…**, **Delete selected version…** |

### Importing a schematic as a part

In a build’s **⋯** menu, choose **Import schematic…** and select a Litematica (`.litematic`),
Sponge/WorldEdit (`.schem`), Java structure (`.nbt`), or legacy MCEdit (`.schematic`) file.
Drag an axis arrow to move the incoming schematic by whole blocks. The X, Y and Z fields give
the position of its minimum corner in build-local coordinates. You can place it beyond the
current edges of the build.

When blocks overlap, choose **Keep existing** or **Replace overlapping blocks** for each
affected part. Air in the schematic leaves existing blocks alone. **Import part** saves
the placement and generates a draft. Future drafts and exports use the same placement and
priority, followed by the build’s normal checks and finishing. New overlaps keep the existing
blocks unless the imported part already has priority over their owner.

Imports require an engine with schematic import support and a build that uses the standard
`mcb.cli.run` entry point. The source file can be up to 32 MiB, with up to 64 MiB of decoded
data and 8,388,608 cells in the source and combined bounds. The app retains the original
file and flags data such as entity contents that the generated versions omit.

Builder Studio checks every used block state against the project’s Minecraft version. A schematic
from a newer release can be imported if all its states fit. If it needs newer blocks, the import
reports the incompatible states. Upgrade the project from the Workspace menu, then choose the
schematic again.

### Generating a draft

**Generate draft** runs the engine's quick _proto_ job on `build.py` and renders a preview. The
**Activity** button beside the screen tabs shows a live dot while it runs (or a red dot if it
fails). Open **Activity** (`Ctrl \``) to see the stage (generating blocks, checking blocks, removing
hidden blocks, saving the schematic, creating preview images), the result, time and the version's
size in blocks, the full job log, and **Copy paste position**, which copies where the file goes in
the world. **Esc** stops a running job after a confirm.

**Draft settings…** limits the draft to an area and names the output. Empty fields use the build's
defaults, and your choices are remembered per build.

| Field                         | Meaning                           |
| ----------------------------- | --------------------------------- |
| Output name                   | The version's file stem in `out/` |
| West edge (X), North edge (Z) | The area's corner                 |
| Width, Depth (blocks)         | The area's size                   |

A full build (finalized, with all checks) runs from the [Export checklist](review-and-export.md#export).

### View modes

| Tab                        | Key | Shows                                                               |
| -------------------------- | --- | ------------------------------------------------------------------- |
| 3D                         | `1` | The version in the game's look (below)                              |
| Preview                    | `2` | The engine's render sheet (`out/<stem>_3d/sheet.png`), zoom and pan |
| Compare: Side by side      | `3` | Two versions next to each other, cameras linked                     |
| Compare: Highlight changes | `4` | A diff drawn over the newer version                                 |

Pick the older version in **Compare with**. In **Highlight changes**, the bridge writes added (lime),
removed (red) and changed (yellow) stained-glass overlays into `out/.diff/<a>__<b>/`; each kind
toggles on its own.

### The 3D view

- **Axis gizmo** (top right): drag it to orbit. Click a bubble to look from that side (Y from the top,
  X from the east, Z from the south); click it again for the opposite side. It is one Tab stop: arrow
  keys move between the bubbles and Enter turns the camera.
- **Mouse**: left-drag on empty space or middle-drag anywhere to orbit, right-drag to pan, the wheel
  to zoom. Middle-drag orbits even while a drawing tool is on.
- **Floor grid and ground axes**: the grid's lines are one block apart up close and 2, 4, 8 … blocks
  apart as you zoom out. The X (red) and Z (blue) lines on the floor cross at the build's own (0, 0, 0),
  solid toward plus and faint toward minus.
- **Height** (right edge): clips the view at a Y level to look inside. `[` and `]` step it.
- **Tool rail** (left edge): the tools for editing blocks by hand (below).

### Editor

The **Editor** panel (**Ctrl I**, or **Editor** beside the screen tabs; a sheet on narrow windows) has
four tabs.

| Tab           | Shows                                                                |
| ------------- | -------------------------------------------------------------------- |
| **Edit**      | Change blocks by hand: the tool, the block and its state, History    |
| **Parts**     | The named parts that built this version (below)                      |
| **Checks**    | The engine's lint results by kind; click a location to show it in 3D |
| **Materials** | Block counts for the version (needs the build tools)                 |

#### Editing blocks

Hand edits change blocks without touching `build.py`. They are saved in `builds/<name>/data/edits.json`,
and every draft and export applies them last, over the code and imported parts, as the part
**Hand edits**. Until the next draft the 3D view draws them over the newest version. You edit the
newest version only; other versions and Compare show their files as they were made. **History** in
the Edit tab shows how many blocks you changed and whether they are saved.

| Tool          | Key | Does                                                                                                                                                                                                                                                          |
| ------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Select**    | `S` | Click a block to select it; Shift-click another for the box between them. The tool HUD shows where it is and the block's state, or the box's size. **Delete** erases it                                                                                       |
| **Place**     | `P` | Click a face to place the chosen block against it                                                                                                                                                                                                             |
| **Erase**     | `E` | Click a block to remove it                                                                                                                                                                                                                                    |
| **Pick**      | `I` | Click a block to place more of it. **Alt**-click picks in any tool                                                                                                                                                                                            |
| **Brush**     | `B` | Drag to add the chosen block into air, or to erase blocks, in a sphere, cube or cylinder. A drag that starts off the build turns the view                                                                                                                     |
| **Paint**     | `N` | Drag over blocks to change them to the chosen block. **Surface only** skips buried blocks; **Keep shape and facing** keeps stairs facing the same way                                                                                                         |
| **Fill**      | `G` | Click to fill with the chosen block: **Connected** (the clicked block and the touching blocks of its kind), **Air** (the air in front of a face) or **Replace** (every block of the clicked kind), inside the selection, the clicked layer or the whole build |
| **Shape**     | `U` | Click a face to stand a box, cylinder or sphere on it, solid or hollow; drag to stamp one every few blocks. **Line** draws from where you press to where you release. Shapes fill only air                                                                    |
| **Terrain**   | `T` | Drag over the ground to raise, lower, smooth or flatten it. **Shift** swaps Raise and Lower                                                                                                                                                                   |
| **Transform** | `M` | Move or copy the selected box: drag the arrows to move it, the ring or `Q` / `R` to turn it, and flip it in the Edit tab. **Enter** applies, **Esc** cancels. Air in the box is left out                                                                      |
| **Ruler**     | `L` | Click two blocks to measure the box between them and the distance. **Copy** puts the numbers on the clipboard                                                                                                                                                 |

- **Blocks** lists every block of the build's Minecraft version. Search by name or id, pick a
  category (Recent, Building, Colored, Natural, Functional, Redstone) and any shapes (Full, Stairs,
  Slab, Wall, Fence, Door). Choosing a block switches to Place.
- **Block** sets the block's state: facing, half, waterlogged and so on. The star makes it a
  favourite, first in Recent.
- **History** lists every edit. Click a row to undo or redo to it; **Start** is the build as you
  opened it. **Ctrl Z** undoes and **Ctrl Y** (or Ctrl Shift Z) redoes; in a text field they edit
  the text instead. History lasts until you close the Workspace. **Discard hand edits…** in its ⋯
  menu removes them all, and Undo still brings them back until then.
- Every tool action is one History entry. The tool HUD in the bottom-left corner of the 3D view
  shows the tool's settings, or what Select selected; `-` and `=` change the size of Brush, Paint
  and Terrain.
- One edit changes up to 32,768 blocks: a bigger erase, fill or transform is refused, and a stroke
  stops there.

#### Parts

Parts are the named `c.op` blocks in `build.py` that built the version, read from the
`<stem>.parts.npz` the engine saves beside it. Files built without `c.op` have no parts.

- Filter the list, select parts, and **Locate in 3D**. Each part shows the line of code that opened it.
- Over the 3D view, **Color by: Parts** gives each part its own color. Click selects a part,
  Shift-click adds one.
- Selecting a part automatically shows a faint tint and thin outline on its visible surfaces.
  **Isolate** shows only the selection. Clear removes the selection and its mask.
- Parts generation shows the current stage and measured progress beside the viewer toolbar, through
  loading and meshing. Generated overlays are cached in `out/.parts/<stem>/`; selection files keep
  their original coordinates while omitting empty space outside their bounds.
- **Ask agent** puts the selection, with its bounding boxes and code lines, into the assistant's input
  as a chip that is sent with the next message.

#### Checks

The engine's lint reports each kind separately; the app labels them:

| Label                    | Engine key    |
| ------------------------ | ------------- |
| Floating blocks          | `floating`    |
| Missing support          | `unattached`  |
| Blocks that will fall    | `gravity`     |
| Incomplete doors or beds | `halves`      |
| Fire risk                | `fire`        |
| Leaves that may decay    | `leaves`      |
| Invalid block states     | `invalid`     |
| Dark areas               | `dark`        |
| See-through gaps         | `see_through` |
| Slab gaps                | `groove`      |
| Block types              | `palette`     |

The exact rules belong to the engine. **Export** requires zero lint problems before the full build.

## Keyboard shortcuts

| Key                       | Action                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| Ctrl K                    | Command palette                                                                 |
| Ctrl ,                    | Open Settings                                                                   |
| Ctrl − / Ctrl + / Ctrl 0  | Decrease / increase / reset interface size                                      |
| ?                         | Show keyboard shortcuts overlay                                                 |
| Ctrl 1 – Ctrl 7           | Switch build screens (Workspace, Review, Variants, Export, Location, Refs, Log) |
| Ctrl Tab / Ctrl Shift Tab | Next / previous build screen                                                    |
| F6 / Shift F6             | Move focus to next / previous workbench region                                  |
| Ctrl J                    | AI assistant panel                                                              |
| Ctrl I                    | Editor panel                                                                    |
| Ctrl \`                   | Activity panel                                                                  |
| Ctrl Enter                | Generate draft                                                                  |
| Esc                       | Stop the running job (with a confirm)                                           |
| `[` / `]`                 | Lower / raise the visible height                                                |
| `1`                       | 3D                                                                              |
| `2`                       | Preview                                                                         |
| `3`                       | Compare side by side                                                            |
| `4`                       | Compare: highlight changes                                                      |
| `S` `P` `E` `I`           | Select, Place, Erase, Pick tools                                                |
| `B` `N` `G` `U` `T`       | Brush, Paint, Fill, Shape, Terrain tools                                        |
| `M` `L`                   | Transform, Ruler tools                                                          |
| `-` / `=`                 | Smaller / bigger Brush, Paint or Terrain                                        |
| `Q` / `R`                 | Turn the Transform box anticlockwise / clockwise                                |
| Enter / Esc               | Apply / cancel a Transform, with the Transform tool on                          |
| Ctrl Z / Ctrl Y           | Undo / redo a hand edit                                                         |
| Delete                    | Erase the selected blocks                                                       |
| Ctrl S / Esc              | Save / cancel while editing in Design log                                       |
| Enter / Shift Enter       | Send / new line, in the assistant's input                                       |
| Shift Tab                 | Next permission mode, in the assistant's input                                  |

Workspace keys are ignored while typing in a field.
