// Blocks sorted into the picker's categories and shapes, and block states as strings.
import type { BlockInfo } from '@shared/api'

export type { BlockInfo, BlockProp } from '@shared/api'

export const CATEGORIES = [
  { id: 'recent', label: 'Recent' },
  { id: 'building', label: 'Building' },
  { id: 'colored', label: 'Colored' },
  { id: 'natural', label: 'Natural' },
  { id: 'functional', label: 'Functional' },
  { id: 'redstone', label: 'Redstone' }
] as const
export type Category = Exclude<(typeof CATEGORIES)[number]['id'], 'recent'>

export const SHAPES = [
  { id: 'full', label: 'Full' },
  { id: 'stairs', label: 'Stairs' },
  { id: 'slab', label: 'Slab' },
  { id: 'wall', label: 'Wall' },
  { id: 'fence', label: 'Fence' },
  { id: 'door', label: 'Door' }
] as const
export type Shape = (typeof SHAPES)[number]['id'] | 'other'

const COLOURS =
  '(?:white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black)'
// first match wins; the game's creative tabs, by name
const RULES: [Category, RegExp][] = [
  [
    'colored',
    new RegExp(
      `^${COLOURS}_(?:wool|carpet|concrete|concrete_powder|terracotta|glazed_terracotta|stained_glass|stained_glass_pane|bed|banner|wall_banner|candle|candle_cake|shulker_box|dye)$`
    )
  ],
  [
    'redstone',
    /^(?:redstone\w*|repeater|comparator|(?:sticky_)?piston|piston_head|moving_piston|observer|dispenser|dropper|hopper|lever|\w+_button|\w+_pressure_plate|tripwire\w*|daylight_detector|target|note_block|tnt|(?:powered_|detector_|activator_)?rail|(?:calibrated_)?sculk_sensor|lightning_rod|trapped_chest|crafter)$/
  ],
  [
    'functional',
    /^(?:crafting_table|(?:blast_)?furnace|smoker|chest|barrel|ender_chest|\w*anvil|enchanting_table|brewing_stand|\w*cauldron|bell|beacon|conduit|(?:soul_)?lantern|\w*torch|\w*campfire|\w+_sign|\w+_hanging_sign|chiseled_bookshelf|lectern|loom|cartography_table|fletching_table|smithing_table|stonecutter|grindstone|composter|jukebox|respawn_anchor|lodestone|scaffolding|ladder|\w*flower_pot|potted_\w+|decorated_pot|candle|candle_cake|end_rod|\w+_head|\w+_skull|\w+_wall_head|\w+_wall_skull|spawner|trial_spawner|vault|\w*shulker_box|bed|cake|end_portal_frame|ender_eye|beehive|bee_nest|suspicious_\w+)$/
  ],
  [
    'natural',
    /^(?:grass_block|\w*dirt|dirt_path|podzol|mycelium|(?:red_)?sand|gravel|clay|mud|\w+_ore|raw_\w+_block|\w+_log|\w+_stem|\w+_leaves|\w+_sapling|\w+_propagule|(?:short_|tall_)?grass|\w*fern|\w+_mushroom(?:_block)?|mushroom_stem|water|lava|\w*ice|snow\w*|cactus|sugar_cane|bamboo\w*|kelp\w*|\w*seagrass|sea_pickle|\w*coral\w*|\w*vines?|moss\w*|sculk(?:_vein|_catalyst|_shrieker)?|netherrack|\w+_nylium|soul_s(?:and|oil)|end_stone|wheat|carrots|potatoes|beetroots|melon\w*|pumpkin\w*|\w*_roots|\w+_fungus|nether_wart\w*|dandelion|poppy|blue_orchid|allium|azure_bluet|\w+_tulip|oxeye_daisy|cornflower|lily_of_the_valley|wither_rose|sunflower|lilac|rose_bush|peony|torchflower\w*|pitcher_\w+|pink_petals|spore_blossom|\w*azalea\w*|dripleaf\w*|big_dripleaf_stem|hanging_roots|glow_lichen|\w*amethyst\w*|pointed_dripstone|dripstone_block|lily_pad|hay_block|bone_block|honey_block|honeycomb_block|cocoa|sweet_berry_bush|cave_vines\w*|frogspawn|\w+_egg|sniffer_egg|obsidian|crying_obsidian|magma_block|glowstone|shroomlight|budding_amethyst|calcite|tuff|deepslate|bedrock)$/
  ]
]

const path = (id: string): string => id.slice(id.indexOf(':') + 1).split('[')[0]

/** The creative tab a block sits in, by its name. */
export function categoryOf(id: string): Category {
  const name = path(id)
  return RULES.find(([, re]) => re.test(name))?.[0] ?? 'building'
}

// blocks without a shape name that still are not a full cube
const NOT_FULL =
  /(?:carpet|button|pressure_plate|torch|sapling|rail|pane|bars|sign|banner|candle|coral|grass$|fern|mushroom$|vines?$|lantern|chain|ladder|lever|pot|head|skull|cake|bed|tulip|orchid|allium|bluet|daisy|cornflower|lily|rose|dandelion|poppy|petals|roots|fungus|sprouts|kelp|seagrass|pickle|wart|crop|wheat|carrots|potatoes|beetroots|stem$|cactus|sugar_cane|bamboo$|scaffolding|rod|anvil|bell|cauldron|hopper|lectern|grindstone|campfire|chest|brewing_stand|enchanting_table|end_portal_frame|stonecutter|composter|daylight_detector|repeater|comparator|redstone_wire|tripwire|snow$|layer|path|farmland|water|lava|air|portal|fire|cobweb|dripleaf|azalea$|amethyst_bud|amethyst_cluster|pointed_dripstone|lichen|vein|spore|propagule|egg|frogspawn|light$|barrier|structure_void|piston_head|moving_piston)/

/** The picker's shape for a block; 'other' for the ones no chip names. */
export function shapeOf(id: string): Shape {
  const name = path(id)
  if (name.endsWith('_stairs')) return 'stairs'
  if (name.endsWith('_slab')) return 'slab'
  if (name.endsWith('_fence') || name.endsWith('_fence_gate')) return 'fence'
  if (name.endsWith('_door') || name.endsWith('_trapdoor')) return 'door'
  if (name.endsWith('_wall')) return 'wall'
  return NOT_FULL.test(name) ? 'other' : 'full'
}

/** A block state string, 'minecraft:oak_stairs[facing=east,half=top]', as an id and its properties. */
export function parseState(state: string): { id: string; props: Record<string, string> } {
  const open = state.indexOf('[')
  const id = open < 0 ? state : state.slice(0, open)
  const props: Record<string, string> = {}
  if (open >= 0)
    for (const pair of state.slice(open + 1, -1).split(',')) {
      const [k, v] = pair.split('=')
      if (k) props[k] = v ?? ''
    }
  return { id: id.includes(':') ? id : `minecraft:${id}`, props }
}

/** A block state string with its properties sorted, as the viewer's palette spells it. */
export function formatState(id: string, props: Record<string, string>): string {
  const keys = Object.keys(props).sort()
  return keys.length ? `${id}[${keys.map((k) => `${k}=${props[k]}`).join(',')}]` : id
}

/** A block's state with every property set: the given ones the block has, its defaults for the rest. */
export function fullState(block: BlockInfo, props: Record<string, string> = {}): string {
  const out: Record<string, string> = {}
  for (const p of block.props)
    out[p.name] = p.values.includes(props[p.name]) ? props[p.name] : block.defaults[p.name]
  return formatState(block.id, out)
}

/** The blocks a picker shows: a search over every block, or a category narrowed to some shapes. */
export function filterBlocks(
  blocks: BlockInfo[],
  {
    category,
    shapes,
    search,
    recent
  }: { category: string; shapes: Shape[]; search: string; recent: string[] }
): BlockInfo[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shaped = (b: BlockInfo): boolean => !shapes.length || shapes.includes(shapeOf(b.id))
  if (words.length)
    return blocks.filter((b) => {
      const text = `${b.id} ${b.label}`.toLowerCase().replace(/_/g, ' ')
      return words.every((w) => text.includes(w)) && shaped(b)
    })
  if (category === 'recent') {
    const byId = new Map(blocks.map((b) => [b.id, b]))
    return recent.flatMap((id) => byId.get(id) ?? []).filter(shaped)
  }
  return blocks.filter((b) => categoryOf(b.id) === category && shaped(b))
}
