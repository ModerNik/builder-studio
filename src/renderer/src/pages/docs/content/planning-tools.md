# Planning tools

> Place a build in a real world, collect references, draft several directions at once, and look up
> blocks and prefabs.

Open **Location**, **Refs** and **Variants** from a build's screen tabs (`Ctrl 5`, `Ctrl 6`, `Ctrl 3`). Open **Labs** from the flask icon in the title bar.

## Build location (site picker)

`/build/<name>/site`: fit a build to real terrain.

1. **Choose a world…** from your worlds folder (Settings → Minecraft), or any folder.
2. Set the map area (its side is 16 to 2048 blocks) and press **Map** to see it top-down.
3. Drag on the map to mark the build's footprint, in world coordinates. Set a margin around the box.
4. Copy the `ORIGIN = (x, y, z)` line into `build.py`.
5. **Write terrain.npz** saves the terrain into `builds/<name>/data/terrain.npz`, with a confirm before
   overwriting an existing one.

The engine reads the save only through copies of its region files. Builder Studio never writes to a
world.

## References

`/build/<name>/refs`: the build's reference board, kept in `builds/<name>/refs/` (the images plus
`index.json`).

- Paste a screenshot anywhere on the board, drop images or links, or type a link or a note.
- Every card has an editable note.
- A deleted image goes to the Recycle Bin and is removed from `refs/index.json`.
- **Attach refs**, under the assistant's input and in the Brief form, sends the chosen references with
  your message (paths and notes; the assistant reads the images itself).

## Variants

`/build/<name>/variants`: draft 2 to 6 directions at once from one brief or one piece of feedback.
Works with any AI assistant (Claude, Codex or Ollama).

- Each lane (A, B, C…) is its own assistant session with its own direction line. Lanes fork the
  Agent panel's session when one is open, or start fresh.
- Lane A copies `<script>.py` to `<script>_A.py`, runs it with `--name <script>_A`, and may write
  nothing else. Builder Studio denies any other write, any Git change and any other build name,
  whatever the prompt says.
- Lanes sit side by side, each with its job cards, permission asks and a follow-up box.
- **Send N to Review** opens one Review round with each lane's newest `*_L` file.
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
