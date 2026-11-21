// The blocks of a Minecraft version with their states, read from the engine's catalog
// (schematica/blocks/data/release_catalog.json.z beside its Python) without starting Python.
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { inflateSync } from 'zlib'
import type { BlockInfo, BlockProp } from '@shared/api'

const CATALOG = 'Lib/site-packages/schematica/blocks/data/release_catalog.json.z'

interface RawState {
  name: string
  type: string
  num_values?: number
  values?: string[]
  default?: unknown
}
interface RawBlock {
  name: string
  displayName?: string
  defaultState?: number
  minStateId?: number
  states?: RawState[]
}
export interface Catalog {
  versions: Record<string, { registry: string }>
  registries: Record<string, number[]>
  definitions: RawBlock[]
}

/** The catalog of the Python at `python`: an installed runtime (python.exe beside Lib) or a venv (Scripts). */
export function catalogPath(python: string): string | null {
  const dir = dirname(python)
  return [join(dir, CATALOG), join(dir, '..', CATALOG)].find((p) => existsSync(p)) ?? null
}

let cached: { path: string; catalog: Catalog } | null = null
export function readCatalog(path: string): Catalog {
  if (cached?.path !== path)
    cached = { path, catalog: JSON.parse(inflateSync(readFileSync(path)).toString('utf8')) }
  return cached.catalog
}

const valuesOf = (s: RawState): string[] =>
  s.type === 'bool'
    ? ['true', 'false'] // the order the game numbers them in
    : (s.values ?? Array.from({ length: s.num_values ?? 1 }, (_, i) => String(i)))

/** A block's default state: its own defaults, else the default state id read as a mixed-radix number over its
 *  properties, last property fastest (the engine's BlockRegistry.resolve does the same). */
function defaultsOf(b: RawBlock, props: BlockProp[]): Record<string, string> {
  const out: Record<string, string> = {}
  let offset = (b.defaultState ?? 0) - (b.minStateId ?? 0)
  for (const [i, p] of [...props.entries()].reverse()) {
    const own = b.states![i].default
    out[p.name] =
      own === undefined || own === null ? p.values[offset % p.values.length] : String(own)
    offset = Math.floor(offset / p.values.length)
  }
  // the engine keeps generated leaves from decaying
  if (b.name.endsWith('_leaves') && 'persistent' in out) out.persistent = 'true'
  return out
}

/** Every block of `version`, or null when the catalog does not know it. */
export function blocksOf(catalog: Catalog, version: string): BlockInfo[] | null {
  const entry = catalog.versions[version]
  if (!entry) return null
  return catalog.registries[entry.registry].map((i) => {
    const b = catalog.definitions[i]
    const props: BlockProp[] = (b.states ?? []).map((s) => ({
      name: s.name,
      type: s.type === 'bool' || s.type === 'int' ? s.type : 'enum',
      values: valuesOf(s)
    }))
    const id = b.name.includes(':') ? b.name : `minecraft:${b.name}`
    return { id, label: b.displayName ?? b.name, props, defaults: defaultsOf(b, props) }
  })
}
