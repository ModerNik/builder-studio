"""Write the schematic reader's test fixtures with the engine's own writers, and what the engine reads back.
Run with the engine's interpreter from the engine checkout:
  ../builder-studio-engine/.venv/Scripts/python.exe src/renderer/src/entities/viewer/lib/render/fixtures/make_fixtures.py"""
import json
import sys
from pathlib import Path

import nbtlib
import numpy as np

ENGINE = Path(sys.argv[1] if len(sys.argv) > 1 else "../builder-studio-engine").resolve()
sys.path[:0] = [str(ENGINE / "lib"), str(ENGINE / ".claude/skills/schematica/scripts")]
from mcb import export, prefab  # noqa: E402
from schematica.blocks.block import Block  # noqa: E402
from schematica.core.palette import Palette  # noqa: E402
from schematica.core.voxel import VoxelGrid  # noqa: E402
from schematica.export.sponge import write_sponge  # noqa: E402

HERE = Path(__file__).parent


def expect(path, data, states, lo):
    """<name>.json: min corner, size and every cell's state in x-fastest, then z, then y order."""
    cells = [states[data[x, y, z]] for y in range(data.shape[1]) for z in range(data.shape[2])
             for x in range(data.shape[0])]
    path.with_suffix(".json").write_text(json.dumps({"min": lo, "size": list(data.shape), "cells": cells}))


def check(path, lo):
    data, states = prefab.load(path)
    expect(path, data, states, lo)


# a small build: the blocks the renderer must draw (bits 4)
mixed = ["minecraft:air", "minecraft:stone", "minecraft:oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]",
         "minecraft:oak_fence[east=true,north=false,south=false,waterlogged=false,west=true]", "minecraft:glass",
         "minecraft:oak_leaves[distance=1,persistent=true,waterlogged=false]", "minecraft:water[level=0]",
         "minecraft:chest[facing=north,type=single,waterlogged=false]", "minecraft:red_stained_glass"]
rng = np.random.default_rng(7)
data = rng.integers(0, len(mixed), (5, 4, 3)).astype(np.uint16)
export.write(data, mixed, HERE / "mixed.litematic")
check(HERE / "mixed.litematic", [0, 0, 0])

# 40 states: 6 bits, so entries span two longs
wide = ["minecraft:air"] + [f"minecraft:{c}_wool" for c in ("white", "orange", "magenta", "light_blue", "yellow", "lime",
        "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black")] + \
       [f"minecraft:{c}_concrete" for c in ("white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
        "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black")] + \
       ["minecraft:stone", "minecraft:dirt", "minecraft:sand", "minecraft:gravel", "minecraft:bricks", "minecraft:tnt",
        "minecraft:glowstone"]
data = rng.integers(0, len(wide), (7, 5, 6)).astype(np.uint16)
export.write(data, wide, HERE / "wide.litematic")
check(HERE / "wide.litematic", [0, 0, 0])

# the same region stored with negative sizes at an offset: min corner = pos + size + 1
t = nbtlib.load(HERE / "mixed.litematic")
reg = next(iter(t["Regions"].values()))
for k, off in zip("xyz", (10, -3, 4)):
    reg["Size"][k] = nbtlib.Int(-int(reg["Size"][k]))
    reg["Position"][k] = nbtlib.Int(off)
t.save(HERE / "negative.litematic")
check(HERE / "negative.litematic", [10 + int(reg["Size"]["x"]) + 1, -3 + int(reg["Size"]["y"]) + 1,
                                    4 + int(reg["Size"]["z"]) + 1])

# a Sponge .schem from the same blocks (the engine's render tool takes both)
data, states = prefab.load(HERE / "mixed.litematic")
write_sponge(VoxelGrid.from_array(data, Palette.from_blocks([Block.parse(b) for b in states[1:]])), HERE / "mixed.schem")
check(HERE / "mixed.schem", [0, 0, 0])
