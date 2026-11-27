# Planning tools

> Place a build in a real world, collect references, draft several directions at once, and look up
> blocks and prefabs.

Open **Location**, **Refs** and **Variants** from a build's screen tabs (`Ctrl 5`, `Ctrl 6`, `Ctrl 3`). Open **Labs** from the flask icon in the title bar.

## Build location (3D world map)

`/build/<name>/site`: explore a real Minecraft world in 3D and set where the build sits.

1. On first open, choose a Minecraft world save (or browse to any world folder), then pick a dimension (**Overworld**, **Nether**, **End**). Your chosen world and all Location settings are remembered automatically across restarts.
2. Navigate freely in **3D**, **Iso**, or **2D** (`1 / 2 / 3`, drag to orbit, right-drag to pan, WASD to fly, or jump to **Spawn** / **Player** / coordinates).
3. The right rail adapts automatically:
   - **Scout terrain** _(before a draft exists)_: click the terrain to position the area, drag the corner handles (or Shift-drag) to resize, and set the terrain margin.
   - **Place build** _(once a `.litematic` draft exists)_: previews your 3D build directly on the terrain; move it with the 3D X/Y/Z handles, click terrain to snap to ground, rotate in 90° steps (`R`), and slice the build layer-by-layer with the right-side layer slider (`[` / `]`).
4. Click **Save location** to write `builds/<name>/data/terrain.npz` + `data/site.json` and update `ORIGIN` in `build.py`.

Builder Studio reads only cached copies of region files and never writes to a world save.

## References

`/build/<name>/refs`: the build's visual reference board, kept in `builds/<name>/refs/` (images plus
`index.json`).

- Paste a screenshot anywhere on the board (`Ctrl+V`), drop images or web links, or use **Add
  images**, **Add link**, and **Add note**.
- Filter by **All / Images / Links / Notes** and search by note, filename, or URL.
- Image cards stay visual-first: empty notes stay hidden at rest, and clicking any filled caption or
  hovering the card lets you edit notes inline. Click an image to open the zoomable Lightbox with
  dimensions, **Copy image**, and inline caption editing.
- Toggle **Attach to chat** on any image, link, or note (or from the Lightbox) to queue it directly
  into the assistant composer's references chip — synced live with the composer's attach menu.
- A deleted image goes to the Recycle Bin and is removed from `refs/index.json`; if an image file is
  removed on disk, the board flags it as missing without breaking the rest of the board.

## Variants

`/build/<name>/variants`: draft 2 to 6 directions at once from one brief or one piece of feedback.
Works with any AI assistant (Claude, Codex or Ollama).

- Each lane (A, B, C…) is its own assistant session with its own direction line. Lanes fork the
  Agent panel's session when one is open, or start fresh.
- Lane A copies `<script>.py` to `<script>_A.py`, runs it with `--name <script>_A`, and may write
  nothing else. Builder Studio denies any other write, any Git change and any other build name,
  whatever the prompt says.
- Lanes sit side by side, each with its job cards, permission asks and a follow-up box.
- **Send N to Review** opens one Review with each lane's newest `*_L` file.
- **Settings → AI assistant → Variants drafted at once** sets how many run at once (2–6, default 3).
  More is faster but uses more of your plan; the meter adds up their cost.

Why not a Git worktree per lane: an editable engine install would ignore its edits, it would miss
uncommitted work, and its outputs would fall outside `builds/<name>/out/`.

## Labs

The flask icon: read-only lookups that help you and the assistant pick materials.

| Tab             | Shows                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Palette**     | Block strips, gradients (ramps) with their shade check, the nearest blocks to a color or block, blends, and the style swatches |
| **Kit catalog** | The engine's `docs/catalog.md` beside its scene sheets                                                                         |
| **Prefabs**     | The `assets/` library on its preview sheets, filtered by category and kind. Click one to copy its id                           |
