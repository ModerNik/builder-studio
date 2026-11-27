// The one contract between main, preload and renderer. Main checks every input with these zod schemas.
import { z } from 'zod'
import { EXPORT_FORMATS, isMinecraftVersion } from './minecraft'
import { buildFolderIssue, projectNameIssue } from './project-name'
import {
  CAPABILITIES,
  DEFAULT_LINT_RULES,
  DEFAULT_LINTER_SETTINGS,
  EFFORTS,
  LINT_RULES,
  MAX_JOB_LOG,
  MAX_JOBS,
  MCP_PORT,
  MCP_URL,
  MODES,
  PROJECT_NAME_MAX_LENGTH,
  PROVIDERS,
  SETUP_STEPS,
  UI_SCALES
} from './constants'

export { PROJECT_NAME_MAX_LENGTH }

/** Wraps a plain `issue(value)` rule (from ./project-name) as a zod check. */
const rule =
  (issue: (s: string) => string) =>
  (s: string, ctx: z.RefinementCtx): void => {
    const message = issue(s)
    if (message) ctx.addIssue({ code: 'custom', message })
  }
/** User-facing project display name, trimmed. */
export const ProjectNameSchema = z.string().trim().superRefine(rule(projectNameIssue))
/** On-disk folder name under builds/ passed to the Python engine (tools.new_build). */
export const BuildFolderNameSchema = z.string().superRefine(rule(buildFolderIssue))
export const ProjectMetaSchema = z.object({ name: ProjectNameSchema })
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>
// plain constants live in ./constants so the renderer can use them without loading zod
export {
  CAPABILITIES,
  DEFAULT_LINT_RULES,
  DEFAULT_LINTER_SETTINGS,
  EFFORTS,
  LINT_RULES,
  MAX_JOB_LOG,
  MAX_JOBS,
  MCP_PORT,
  MCP_URL,
  MODES,
  PROVIDERS,
  SETUP_STEPS,
  UI_SCALES
}

export const ProviderSchema = z.enum(PROVIDERS)
export type Provider = z.infer<typeof ProviderSchema>
export const SessionRefSchema = z.object({ provider: ProviderSchema, id: z.uuid() })
export type SessionRef = z.infer<typeof SessionRefSchema>
export interface AgentCapabilities {
  variants: boolean
  fork: boolean
  compact: boolean
  cost: boolean
  effort: boolean
  mcpToggle: boolean // MCP servers switch on and off in a live session
  modes: readonly AgentMode[] // the permission modes the composer offers
}
export interface ProviderDiagnostic {
  provider: Provider
  ok: boolean
  detail: string
}

export const SetupProgressSchema = z.object({
  step: z.enum(SETUP_STEPS).default('welcome'),
  completed: z.boolean().default(false)
})
export type SetupProgress = z.infer<typeof SetupProgressSchema>
export type Requirement =
  'workspace' | 'engine' | 'pack' | 'browser' | 'export' | 'ai' | 'git' | 'identity'
export type Feature =
  | 'browse'
  | 'engine'
  | 'viewer'
  | 'render'
  | 'proto'
  | 'export'
  | 'ai'
  | 'variants'
  | 'newBuild'
  | 'commit'
export type Repair = 'workspace' | 'runtime' | 'minecraft' | 'ai'
export interface RequirementDiagnostic {
  ok: boolean
  detail: string
  repair: Repair
}
export interface FeatureAvailability {
  ok: boolean
  missing: Requirement[]
}
export interface Availability {
  checkedAt: number
  requirements: Record<Requirement, RequirementDiagnostic>
  features: Record<Feature, FeatureAvailability>
}

export type LintRule = (typeof LINT_RULES)[number]
export type LintRuleToggles = Record<LintRule, boolean>

export const LinterSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  rules: z
    .object({
      floating: z.boolean().default(false),
      unattached: z.boolean().default(true),
      gravity: z.boolean().default(true),
      halves: z.boolean().default(true),
      fire: z.boolean().default(true),
      leaves: z.boolean().default(true),
      invalid: z.boolean().default(true),
      dark: z.boolean().default(true),
      see_through: z.boolean().default(true),
      groove: z.boolean().default(true)
    })
    .default(DEFAULT_LINT_RULES)
})
export type LinterSettings = z.infer<typeof LinterSettingsSchema>

export const MinecraftVersionSchema = z
  .string()
  .refine(isMinecraftVersion, 'Unsupported Minecraft version')

export const SettingsSchema = z.object({
  version: z.literal(2).default(2),
  workspace: z.string(), // user builds, references and review records
  setup: SetupProgressSchema.default({ step: 'welcome', completed: false }),
  saves: z.string().default(''), // optional world saves directory
  resources: z.string().default(''), // installed workflow, catalogs and renderer resources
  runtime: z.string().default(''), // activated runtime directory
  runtimeHome: z.string().default(''), // managed version directories; empty = userData/runtime
  previousRuntime: z.string().default(''), // retained working runtime for rollback
  browser: z.string().default(''), // managed Playwright browser directory
  git: z.string().default(''), // managed Git executable; installed Git takes precedence
  cache: z.string().default(''), // packs, temporary renders and staging
  assets: z.string().default(''), // empty = <workspace>/assets
  importSource: z.string().default(''), // legacy repo suggestion; never activated automatically
  python: z.string(), // empty = <runtime>/python.exe; explicit development interpreter supported
  schematics: z.string(), // the game's Litematica folder for finals (MCB_SCHEMATICS)
  jar: z.string(), // Minecraft client jar (MCB_MC_JAR); empty = mcb's own search
  minecraftVersion: MinecraftVersionSchema.optional(),
  minecraftFiles: z
    .record(
      MinecraftVersionSchema,
      z.object({ jar: z.string().optional(), pack: z.string().optional() })
    )
    .optional(),
  claude: z.string(), // claude.exe; empty = detected (main/detect.ts)
  provider: ProviderSchema.default('claude'),
  codex: z.string().default(''), // codex.exe; empty = detected (main/detect.ts)
  gitBash: z.string().default(''), // Claude's separate Windows prerequisite, never MinGit
  ollamaEndpoint: z.string().default('http://127.0.0.1:11434'),
  ollamaModel: z.string().trim().default(''), // already installed; never downloaded by the app
  pack: z.string(), // jar-built texture pack; empty = <cache>/DEFAULT_PACK (main/locations.ts)
  // the embedded agent's "Always" rules per build: `Tool` or `Tool(prefix)` (main/permissions.ts)
  agentAllow: z.record(z.string(), z.array(z.string())).default({}),
  variantCap: z.number().int().min(2).max(6).default(3), // parallel variant sessions at once
  appearance: z
    .object({
      theme: z.enum(['dark', 'light', 'system']).default('dark'), // system follows the OS
      scale: z.number().min(UI_SCALES[0]).max(UI_SCALES.at(-1)!).default(1) // whole-UI zoom, Ctrl - / + / 0
    })
    .default({ theme: 'dark', scale: 1 }),
  linter: LinterSettingsSchema.default(DEFAULT_LINTER_SETTINGS)
})
export type Settings = z.infer<typeof SettingsSchema>

export const NewBuildNameSchema = ProjectNameSchema
export const ImportRequestSchema = z.object({
  source: z.string().min(1),
  destination: z.string().min(1),
  assets: z.boolean()
})
export type ImportRequest = z.infer<typeof ImportRequestSchema>
export interface ImportPreview extends ImportRequest {
  id: string
  builds: number // folders the Gallery will list: a build.py or DESIGN.md, _group/ one level down, no _archive
  files: number
  bytes: number
  required: number
  available: number
  warnings: string[]
}
export interface ImportState {
  busy: boolean
  stage: string
  copied: number
  total: number
  error?: string
}

export type RuntimeAction = 'engine' | 'browser' | 'git' | 'rollback'
export interface RuntimeDelivery {
  mode: 'bundled' | 'download'
}
export interface RuntimeState {
  busy: boolean
  action?: RuntimeAction
  stage: string
  received?: number
  total?: number
  error?: string
}
export interface RuntimeDiagnostics {
  engine: { ok: boolean; detail: string }
  browser: { ok: boolean; detail: string }
  git: { ok: boolean; detail: string }
  identity: { ok: boolean; detail: string }
  previousRuntime: string
}

const BlockCoordinatesSchema = z.tuple([z.int32(), z.int32(), z.int32()])
export type BlockCoordinates = z.infer<typeof BlockCoordinatesSchema>
export const SchematicChooseSchema = z.object({
  build: z.string().optional(),
  minecraftVersion: MinecraftVersionSchema.optional()
})
export const SchematicInspectSchema = z.object({ id: z.uuid(), position: BlockCoordinatesSchema })
export const SchematicCommitSchema = SchematicInspectSchema.partial({ position: true }).extend({
  name: NewBuildNameSchema.optional(),
  revision: z.string().optional(),
  replace: z.array(z.string()).optional(),
  acceptWarnings: z.boolean().optional()
})
export const SchematicInfoSchema = z.object({
  size: z.tuple([z.int32().positive(), z.int32().positive(), z.int32().positive()]),
  blocks: z.int().positive(),
  warnings: z.array(z.string()),
  sourceDataVersion: z.int().positive().optional()
})
export type SchematicSession = z.infer<typeof SchematicInfoSchema> & {
  id: string
  name: string
  sourceUrl: string
  minecraftVersion?: string
}
export const SchematicInspectionSchema = z.object({
  revision: z.string(),
  overlaps: z.array(z.object({ owner: z.string(), label: z.string(), count: z.int().positive() })),
  blocks: z.int().positive()
})
export type SchematicInspection = z.infer<typeof SchematicInspectionSchema> & { baseUrl: string }
export type SchematicCommit = z.infer<typeof SchematicCommitSchema>

export const JobSpecSchema = z
  .discriminatedUnion('part', [
    z.object({
      part: z.enum(['proto', 'check', 'full']),
      build: z.string().min(1),
      name: z
        .string()
        .regex(/^[\w.-]*$/)
        .optional(),
      x0: z.number().int().optional(),
      z0: z.number().int().optional(),
      sx: z.number().int().positive().optional(),
      sz: z.number().int().positive().optional(),
      seed: z.number().int().optional(),
      views: z
        .string()
        .regex(/^[\w,]*$/)
        .optional(),
      look: z.enum(['game', 'sun', 'flat']).optional(),
      format: z.enum(EXPORT_FORMATS).optional(), // full: export schematic format override
      ship: z.boolean().optional(), // full: finalize into a staging folder, not the game's (ship:finalize copies it)
      noRender: z.boolean().optional() // generate a draft or full export without a preview
    }),
    z.object({
      part: z.literal('dump'),
      build: z.string().min(1),
      path: z.string().min(1), // repo-relative .litematic
      axis: z.enum(['x', 'y', 'z']),
      index: z.number().int()
    })
  ])
  .refine(
    (s) => !('noRender' in s && s.noRender) || s.part !== 'check',
    'Only draft and full builds support no preview'
  )
export type JobSpec = z.infer<typeof JobSpecSchema>

const Xyz = z.tuple([z.number().int(), z.number().int(), z.number().int()])
const RepoPath = z
  .string()
  .regex(/^builds\/[\w./-]+$/)
  .refine((p) => !p.split('/').includes('..'))

/** builds/<name>/review/round_N.json: one review round as the user left it (engine docs/pipeline.md §6).
 *  Pins on blocks name a cell in the file's own coordinates (the bridge's numpy indices, `build.py dump`);
 *  pins on sheets only a pixel of that PNG. */
export const ReviewRoundSchema = z.object({
  round: z.number().int().positive(),
  build: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  question: z.string(),
  files: z
    .array(
      z.object({
        name: z.string().min(1), // the file's stem, as Claude named it
        path: RepoPath, // builds/<name>/out/<stem>.litematic
        paste: Xyz.nullable(), // world position of the file's min corner, null if unknown
        sheet: RepoPath.nullable()
      })
    )
    .min(1),
  pick: z.string().nullable(), // a files[].name, or null: none of them
  approved: z.array(z.string()), // parts approved this round
  notes: z.string(),
  pins: z.array(
    z.union([
      z.object({
        n: z.number().int().positive(),
        file: z.string(),
        block: Xyz,
        state: z.string(), // minecraft:air when the pin is on an empty cell
        view: z.string(), // the camera preset it was dropped in (iso_se, top, orbit…)
        text: z.string()
      }),
      z.object({
        n: z.number().int().positive(),
        file: z.string(),
        sheet: RepoPath,
        px: z.tuple([z.number().int(), z.number().int()]), // pixel of the sheet PNG, from its top left
        text: z.string()
      })
    ])
  )
})
export type ReviewRound = z.infer<typeof ReviewRoundSchema>
export type ReviewPin = ReviewRound['pins'][number]

/** A review the agent asked for (MCP request_review) or the user opened: what the Review screen shows. */
export interface ReviewRequest {
  id: string | null // the MCP request waiting for the answer, null when the user opened it
  build: string
  question: string
  variants: string[] // repo-relative .litematic paths
  parts: string[] // part names offered as "approve" chips
}

export interface SavedRound {
  round: ReviewRound
  path: string // repo-relative review/round_N.json
}

/** What the renderer reports to main for the MCP status() tool. */
export const AppStateSchema = z.object({
  build: z.string().nullable(),
  version: z.string().nullable(),
  tab: z.string(),
  pick: z.object({ cell: Xyz, state: z.string().optional() }).nullable(),
  parts: z.array(z.string()), // the Parts tab selection, op names
  review: z.object({ build: z.string(), question: z.string() }).nullable()
})
export type AppState = z.infer<typeof AppStateSchema>

/** One `@mcb {json}` line from a build job (docs/tools/mcb.md, "Contract for other processes"). */
export type McbEvent =
  | { v: number; event: 'stage'; name: string }
  | { v: number; event: 'lint'; counts: Record<string, number> }
  | { v: number; event: 'blocks'; total: number; hidden_removed?: number }
  | {
      v: number
      event: 'wrote'
      path: string
      shape: [number, number, number]
      paste: [number, number, number]
    }
  | { v: number; event: 'sheet'; path: string }
  | { v: number; event: 'bill'; total: number; top: [string, number][] }
  | { v: number; event: 'copied'; path: string }
  | { v: number; event: 'done'; seconds: number }

export type JobState = 'running' | 'done' | 'failed' | 'cancelled'

export interface Job {
  minecraftVersion?: string
  id: number
  spec: JobSpec
  state: JobState
  started: number
  ended?: number
  code?: number | null
  stage?: string
  staging?: string // ship jobs: the MCB_SCHEMATICS folder `full` finalized into
  events: McbEvent[]
  log: string[] // human lines, stdout and stderr
}

export type JobUpdate =
  | { id: number; kind: 'start'; job: Job }
  | { id: number; kind: 'log'; lines: string[] }
  | { id: number; kind: 'event'; event: McbEvent }
  | { id: number; kind: 'end'; state: JobState; code: number | null }

export interface Round {
  n: number
  title: string
}

export interface BuildSummary {
  name: string // relative to builds/, posix (e.g. castle, _examples/showcase)
  displayName: string // user-facing project name from project.json, or `name` when absent
  minecraftVersion?: string
  status: string[] // bullet lines of the DESIGN.md "## Status" block
  rounds: Round[]
  preview?: string // repo-relative posix path of the final/latest build's full isometric render PNG
  previewMtime?: number // mtime of `preview` for cache busting
  sheet?: string // repo-relative posix path of the newest out/**/sheet.png
  // out/*.litematic, newest first; sheet: its <stem>_3d (or _ctx) sheet.png; parts: a <stem>.parts.npz beside it
  versions: {
    path: string
    mtime: number
    size: number
    sheet?: string
    parts?: boolean
    minecraftVersion?: string
    /** Where the file's (0, 0, 0) sits in build coordinates, from <stem>.minecraft.json; [0, 0, 0] when absent. */
    origin?: [number, number, number]
  }[]
  shipped: string[] // stems of exported versions, from the DESIGN.md "### Shipped <stem>" headings
  mtime: number
}

export interface SetupItem {
  path: string | null
  ok: boolean
}

export type LintWhere = [string, number, [number, number, number]][]
export interface LintResult {
  counts: Record<string, number>
  where: Record<string, LintWhere>
}
export interface BillResult {
  total: number
  top: [string, number][]
}

export interface BridgeMethods {
  ping: {
    params: Record<string, never>
    result: { protocol: number; mcb_version: string; python: string }
  }
  check_setup: { params: Record<string, never>; result: Record<string, SetupItem> }
  lint: {
    params: { path: string; anchor?: string; dark?: boolean; n?: number }
    result: LintResult
  }
  bill: { params: { path: string; top?: number }; result: BillResult }
  dump: {
    params: { path: string; axis: string; index: number; box?: number[] }
    result: { text: string }
  }
  layer: {
    params: { path: string; y: number }
    result: { shape: [number, number, number]; y: number; states: string[]; cells: number[][] } // cells[x][z]
  }
  render: {
    params: { path: string; out?: string; views?: string; size?: number }
    result: { path: string }
  }
  compare: {
    params: { rows: [string, string[]][]; out: string; height?: number }
    result: { path: string }
  }
  diff: {
    params: { a: string; b: string; out?: string; tint?: boolean }
    result: {
      added: number
      removed: number
      changed: number
      path: string // tint: the folder of the three files
      paths: Record<'added' | 'removed' | 'changed', string | null> // tint only; null when that kind is empty
    }
  }
  parts: {
    params: { path: string; cell?: number[] }
    result: { parts: PartInfo[] | null; at: string | null } // parts null: no .parts.npz, or stale; at: the op of cell
  }
  part_file: {
    params: { path: string; names: string[]; output?: 'both' | 'isolated'; crop?: boolean }
    result: { isolated: string; highlight?: string; blocks: number }
  }
  part_colors: {
    params: { path: string; names?: string[]; crop?: boolean } // cropped files retain their original region position
    result: { path: string; colors: Record<string, string> } // under out/.parts/<stem>/; op name -> block
  }
  site_regions: {
    params: { world: string }
    result: { regions: [number, number][]; blocks: [number, number, number, number] | null }
  }
  site_map: {
    params: { world: string; box: number[]; out?: string }
    result: {
      path: string // PNG, 1 px per block, x right, z down
      heights: string // int16 LE top-block y, rows of z, -32768 where no chunk
      origin: [number, number] // world x, z of pixel 0, 0
      size: [number, number]
      y: [number, number] | null
      missing: number
    }
  }
  site_terrain: {
    params: { world: string; box: number[]; build: string; margin?: number; overwrite?: boolean }
    result: {
      exists: boolean // true: nothing written, ask before overwrite
      path: string
      shape?: [number, number]
      missing?: number
      inside?: [number, number, number] | null // min, max, median top-block y
      rim?: [number, number, number] | null
    }
  }
  palette_blocks: { params: Record<string, never>; result: { blocks: string[] } }
  palette_ramp: {
    params: { blocks: string[]; light_first?: boolean }
    result: { blocks: string[]; check: PaletteCheck }
  }
  palette_nearest: {
    params: { target: string | number[]; k?: number }
    result: { blocks: string[] }
  }
  palette_blend: {
    params: { a: string; b: string; n?: number }
    result: { blocks: string[]; check: PaletteCheck }
  }
  styles: {
    params: Record<string, never>
    // mcb.styles sheets: blocks are strings, mixes are [block, weight][]; swatch is a repo path or null
    result: Record<
      string,
      Record<string, string | [string, number][] | string[] | null> & { swatch: string | null }
    >
  }
  catalog: { params: Record<string, never>; result: { doc: string; sheets: string[] } }
}
/** One op of a Canvas build: its name, kept blocks, inclusive cell box, and where build code opened it. */
export interface PartInfo {
  name: string // "-": cells written outside any op
  blocks: number
  box: [[number, number, number], [number, number, number]]
  sources: [string, number, string][] // [workspace-relative file, line, function]
}
/** mcb.palette.check: lightness per block, value range, hue swing in degrees, texture busyness, problems. */
export type PaletteCheck = {
  L: number[]
  range: number
  hue_swing: number
  busy: number[]
  problems: string[]
}
export type BridgeMethod = keyof BridgeMethods
export const BridgeProgressSchema = z.object({
  stage: z.enum([
    'waiting',
    'reading',
    'selecting',
    'colors',
    'encoding',
    'saving',
    'loading',
    'meshing'
  ]),
  fraction: z.number().min(0).max(1).nullable()
})
export type BridgeProgress = z.infer<typeof BridgeProgressSchema>

export const BridgeCallSchema = z.object({
  requestId: z.string().uuid().optional(),
  minecraftVersion: MinecraftVersionSchema.optional(),
  method: z.enum([
    'ping',
    'check_setup',
    'lint',
    'bill',
    'dump',
    'layer',
    'render',
    'compare',
    'diff',
    'parts',
    'part_file',
    'part_colors',
    'site_regions',
    'site_map',
    'site_terrain',
    'palette_blocks',
    'palette_ramp',
    'palette_nearest',
    'palette_blend',
    'styles',
    'catalog'
  ]),
  params: z.record(z.string(), z.unknown()).default({})
})

/** builds/<b>/data/edits.json: blocks set by hand in the Editor, in build coordinates. The engine sets them
 *  last on every draft and export. `cells` holds x, y, z, s for each cell: s is 1 + an index into `states`,
 *  or 0 where the block was removed. */
export const EditsFileSchema = z.object({
  version: z.literal(1),
  states: z.array(
    z
      .string()
      .regex(/^[a-z0-9_.-]+:[a-z0-9_/.-]+(\[[a-z0-9_]+=[a-z0-9_]+(,[a-z0-9_]+=[a-z0-9_]+)*\])?$/)
  ),
  cells: z.array(z.number().int()).refine((c) => c.length % 4 === 0, 'cells come in fours')
})
export type EditsFile = z.infer<typeof EditsFileSchema>

/** One property of a block: its values in the game's order. */
export interface BlockProp {
  name: string
  type: 'enum' | 'bool' | 'int'
  values: string[]
}
/** A block of a Minecraft version, from the engine's catalog (main/runtime/blocks.ts). */
export interface BlockInfo {
  id: string // minecraft:oak_stairs
  label: string // Oak Stairs
  props: BlockProp[]
  defaults: Record<string, string>
}

/** builds/<name>/refs/index.json: the build's reference board (main/refs.ts). */
export const RefSchema = z.object({
  id: z.string(),
  kind: z.enum(['image', 'link', 'note']),
  added: z.string(),
  note: z.string(),
  file: z
    .string()
    .regex(/^[\w-]+\.\w+$/)
    .optional(), // image, beside index.json
  title: z.string().optional(), // image: its original file name
  url: z.string().optional(), // link
  missing: z.boolean().optional() // runtime-only: true when an image file is absent from refs/
})
export type Ref = z.infer<typeof RefSchema>
export const RefsIndexSchema = z.object({ refs: z.array(RefSchema) })
export const RefAddSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('image'),
    name: z.string(),
    data: z.instanceof(Uint8Array),
    note: z.string()
  }),
  z.object({ kind: z.literal('link'), url: z.string(), note: z.string() }),
  z.object({ kind: z.literal('note'), note: z.string() })
])
export type RefAdd = z.infer<typeof RefAddSchema>
export const RefUpdateSchema = z.object({
  note: z.string().optional(),
  url: z.string().optional(),
  title: z.string().optional()
})
export type RefUpdate = z.infer<typeof RefUpdateSchema>

export type Effort = (typeof EFFORTS)[number]

export type AgentModel = {
  value: string
  name: string
  isDefault?: boolean
  efforts?: Effort[]
  defaultEffort?: Effort
}
export type AgentMode = (typeof MODES)[number]

/** One user turn for the embedded agent. A different build or session than the live one restarts the query. */
export const AgentSendSchema = z.object({
  provider: ProviderSchema.default('claude'),
  build: z.string().min(1),
  text: z.string().min(1),
  resume: SessionRefSchema.nullable(),
  model: z.string().nullable(), // null = the CLI's default
  effort: z.enum(EFFORTS).nullable(),
  title: z.string().optional(), // a new session's title
  mode: z.enum(MODES).optional(), // the permission mode; 'plan': the agent plans and asks before it edits
  attachments: z.array(z.string().min(1)).max(10).optional() // workspace-relative, from agent.attach
})
export type AgentSend = z.infer<typeof AgentSendSchema>
/** The Agent panel runs several threads at once; each send names its thread (a renderer-made uuid). */
export const ThreadSendSchema = z.object({ thread: z.uuid(), send: AgentSendSchema })
/** An agent event and the thread it belongs to; null is the provider's own state (login, provider switch). */
export interface ThreadEvent<T> {
  thread: string | null
  data: T
}
/** A skill or slash command the composer offers after / (Claude) or $ (Codex). */
export interface AgentCommand {
  name: string
  description: string
  hint: string
  skill?: boolean
}
export interface AgentRewindPoint {
  id: string
  text: string
}
export interface AgentRewindPreview {
  files: string[]
  unavailable: string | null
}
export interface McpStatus {
  name: string
  status: string // connected, failed, needs-auth, pending, disabled, …
  scope: string | null // project, user, sdk, …
  error: string | null
}

export interface AgentState {
  provider: Provider
  capabilities: AgentCapabilities
  build: string | null
  sessionId: string | null
  status: 'off' | 'starting' | 'idle' | 'running'
  mode: AgentMode
  model: string | null
  effort: Effort | null
  context: { tokens: number; max: number; categories?: { name: string; tokens: number }[] } | null
  cost: number | null // provider-reported USD; unavailable stays null
  usage: {
    input: number
    output: number
    cacheRead: number | null
    cacheWrite: number | null
    reasoning: number | null
  } | null
  auth: string | null // Claude: init apiKeySource; Codex: the account type
  error: string | null
}

export interface QuestionOption {
  label: string
  description: string
  preview?: string
}

export interface AgentQuestion {
  id: string // Claude: question text; Codex: question.id
  header: string
  question: string
  options: QuestionOption[] // empty => free-text question
  multiSelect: boolean
  allowOther: boolean
  secret?: boolean
}

/** A tool call or interactive prompt the CLI asks the app about (canUseTool / requestUserInput). */
export interface PermissionAsk {
  id: string // the tool_use id
  build: string
  tool: string
  kind?: 'permission' | 'plan' | 'question'
  input: Record<string, unknown>
  questions?: AgentQuestion[]
  title: string | null // the CLI's own sentence, when it gives one
  reason: string | null // why the CLI asks
  guard: string | null // why it can never be allowed "Always"
  rule: string | null // what "Always" would store
  agent: string | null // the subagent asking, if any
}

export const PermitSchema = z.object({
  id: z.string(),
  decision: z.enum(['allow', 'always', 'deny']),
  mode: z.enum(MODES).optional(), // an approved plan continues in this mode
  feedback: z.string().max(50_000).optional(), // plan revision feedback when denying ExitPlanMode
  editedPlan: z.string().max(200_000).optional(), // user-edited plan text when approving ExitPlanMode
  answers: z.record(z.string(), z.array(z.string())).optional(), // question answers keyed by AgentQuestion.id
  annotations: z
    .record(z.string(), z.object({ preview: z.string().optional(), notes: z.string().optional() }))
    .optional()
})
export type Permit = z.infer<typeof PermitSchema>

/** Parallel variants (main/variants.ts): one prompt per lane, each lane a session of its own. */
export const VariantStartSchema = z.object({
  build: z.string().min(1),
  lanes: z
    .array(z.object({ lane: z.enum(['A', 'B', 'C', 'D', 'E', 'F']), text: z.string().min(1) }))
    .min(1)
    .max(6),
  from: z.uuid().nullable(), // the Agent panel's session to fork per lane; null = fresh sessions
  model: z.string().nullable(),
  effort: z.enum(EFFORTS).nullable(),
  mode: z.enum(MODES).optional()
})
export type VariantStart = z.infer<typeof VariantStartSchema>
/** A lane's agent event, as variant:msg / variant:state / variant:ask carry it. */
export interface LaneEvent<T> {
  lane: string
  data: T
}

export interface AgentSession {
  provider: Provider
  id: string
  title: string
  tag: string | null
  modified: number
}

/** Provider-independent events. Native SDK/protocol payloads stay in main. */
export type AgentMsg =
  | { type: 'user'; id: string; text: string; point?: string; timestamp?: number }
  | {
      type: 'text'
      id: string
      text: string
      parent: string | null
      delta?: boolean
      replaceLive?: boolean
      plan?: boolean // a Codex plan-mode proposal
      timestamp?: number
    }
  | {
      type: 'tool'
      id: string
      name: string
      input: Record<string, unknown>
      parent: string | null
    }
  | { type: 'tool-result'; id: string; text: string; error: boolean }
  | { type: 'note' | 'turn-end'; id: string; text: string; error?: boolean }
  | { type: 'suggestion'; id: string; text: string | null }

/** What each empty settings path field resolves to on this machine; null when nothing is found. */
export const WORLD_DIMENSIONS = ['overworld', 'nether', 'end'] as const
export const WorldDimensionSchema = z.enum(WORLD_DIMENSIONS)
export type WorldDimension = z.infer<typeof WorldDimensionSchema>

export interface WorldInfo {
  name: string
  path: string
  dataVersion: number | null
  spawn: [number, number, number] | null
  player: [number, number, number] | null
  playerDimension: WorldDimension | null
  dimensions: WorldDimension[]
  regions: Record<WorldDimension, [number, number][]>
}

export const SitePlacementSchema = z.object({
  version: z.literal(1),
  world: z.string().min(1),
  dimension: WorldDimensionSchema.default('overworld'),
  mode: z.enum(['area', 'build']),
  box: z.tuple([z.int32(), z.int32(), z.int32(), z.int32()]),
  areaBox: z.tuple([z.int32(), z.int32(), z.int32(), z.int32()]).optional(),
  origin: z.tuple([z.int32(), z.int32(), z.int32()]),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  margin: z.int32().min(0).default(48),
  versionPath: z.string().optional(),
  cameraMode: z.enum(['3d', 'iso', 'top']).optional(),
  lighting: z.enum(['sun', 'game']).optional(),
  clipY: z.int32().min(0).nullable().optional(),
  ground: z
    .object({
      min: z.int32(),
      max: z.int32(),
      median: z.int32()
    })
    .optional()
})
export type SitePlacement = z.infer<typeof SitePlacementSchema>
export const SiteSaveMetaSchema = z.object({
  build: z.string().min(1),
  placement: SitePlacementSchema,
  updateBuildOrigin: z.boolean().optional()
})

/** What each empty settings path field resolves to on this machine; null when nothing is found. */
export type Detected = {
  claude: string | null
  codex: string | null
  gitBash: string | null
  jar: string | null
  saves: string | null
  schematics: string | null
  python: string | null
  runtimeHome: string | null
  cache: string | null
  assets: string | null
}

export interface PathCheck {
  name: Exclude<keyof Settings, 'agentAllow' | 'variantCap' | 'version' | 'importSource' | 'setup'>
  path: string
  ok: boolean
}

/** The auto-updater (main/updater.ts): installs check GitHub releases on launch and download in the background. */
export type UpdateState =
  | { s: 'off'; why: string } // development build
  | { s: 'idle' } // up to date
  | { s: 'checking' }
  | { s: 'downloading'; version: string; percent: number }
  | { s: 'ready'; version: string } // downloaded: restart to install
  | { s: 'error' }

export interface ShipCommitResult {
  committed: boolean
  output: string
}

export const RENDER_IMAGE_FORMATS = ['png', 'webp', 'jpeg'] as const
export const RenderImageFormatSchema = z.enum(RENDER_IMAGE_FORMATS)
export type RenderImageFormat = z.infer<typeof RenderImageFormatSchema>

const NonEmptyBytes = z.instanceof(Uint8Array).refine((b) => b.byteLength > 0, 'Empty image data')

export const RenderCopyImageSchema = z.object({
  data: NonEmptyBytes
})
export const RenderSaveImageSchema = z.object({
  defaultName: z.string().min(1).max(200),
  format: RenderImageFormatSchema,
  data: NonEmptyBytes
})
export const RenderSaveBatchSchema = z.object({
  files: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .max(200)
          .refine(
            (n) => !n.includes('/') && !n.includes('\\') && !n.includes('..'),
            'Invalid filename'
          ),
        data: NonEmptyBytes
      })
    )
    .min(1)
    .max(32)
})
export const RenderSaveBuildPreviewSchema = z.object({
  build: z.string().min(1),
  versionPath: RepoPath,
  kind: z.enum(['thumbnail', 'sheet']),
  data: NonEmptyBytes
})

export interface WindowState {
  maximized: boolean
}

/** window.studio: everything the renderer may ask of main. */
export interface StudioApi {
  window: {
    /** True on Windows and Linux where the renderer draws caption buttons in the title bar; false on macOS. */
    controls: boolean
    state(): Promise<WindowState>
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    onState(cb: (s: WindowState) => void): () => void
  }
  setup: {
    suggestion(): Promise<string>
    prepare(): Promise<void>
    progress(progress: SetupProgress): Promise<Settings>
    pickFile(defaultPath: string): Promise<string | null>
  }
  availability: {
    get(refresh?: boolean): Promise<Availability>
    onChanged(cb: () => void): () => void
  }
  workspace: {
    pick(defaultPath: string): Promise<string | null>
    open(): Promise<void> // the workspace folder in Explorer
    bootstrap(): Promise<void>
    preview(request: ImportRequest): Promise<ImportPreview>
    import(id: string): Promise<string>
    cancel(): Promise<void>
    recover(destination: string): Promise<void>
    state(): Promise<ImportState>
    onState(cb: (s: ImportState) => void): () => void
  }
  runtime: {
    delivery(): Promise<RuntimeDelivery>
    state(): Promise<RuntimeState>
    diagnose(): Promise<RuntimeDiagnostics>
    install(action: RuntimeAction): Promise<void>
    cancel(): Promise<void>
    identity(name: string, email: string): Promise<void>
    onState(cb: (s: RuntimeState) => void): () => void
  }
  settings: {
    get(): Promise<Settings>
    set(s: Settings): Promise<Settings>
    checkPaths(): Promise<PathCheck[]>
    detected(): Promise<Detected>
    onChanged(cb: (s: Settings) => void): () => void // saved outside the renderer (UI scale keys)
  }
  builds: {
    create(name: string, minecraftVersion?: string): Promise<string>
    upgrade(name: string, version: string): Promise<void>
    list(): Promise<BuildSummary[]>
    onChanged(cb: () => void): () => void
    deleteVersion(path: string): Promise<void> // the .litematic and its _3d/ renders, to the Recycle Bin
    rename(name: string, to: string): Promise<string> // the new build name
    archive(name: string): Promise<string> // out/ to the Recycle Bin, the sources to builds/_archive/
    outSize(name: string): Promise<number>
  }
  minecraft: {
    installations(): Promise<{ version: string; jar: string }[]>
    pack(version?: string): Promise<{ url: string }>
  }
  schematic: {
    choose(build?: string, minecraftVersion?: string): Promise<SchematicSession | null>
    inspect(id: string, position: BlockCoordinates): Promise<SchematicInspection>
    commit(input: SchematicCommit): Promise<{ build: string; part?: string }>
    cancel(id: string): Promise<void>
  }
  jobs: {
    run(spec: JobSpec): Promise<number>
    cancel(id: number): Promise<void>
    list(): Promise<Job[]>
    onUpdate(cb: (u: JobUpdate) => void): () => void
  }
  review: {
    list(build: string): Promise<ReviewRound[]>
    save(round: ReviewRound, requestId: string | null): Promise<SavedRound> // main numbers the round
    cancel(requestId: string): Promise<void> // the agent's request_review returns without a round
    pending(): Promise<ReviewRequest[]>
    onRequest(cb: (r: ReviewRequest) => void): () => void
    onClosed(cb: (id: string) => void): () => void
  }
  design: {
    read(build: string): Promise<string> // DESIGN.md, '' when there is none
    write(build: string, base: string, md: string): Promise<void> // refused if Status changed or base is stale
    reveal(build: string): Promise<void> // reveals DESIGN.md (or the build folder) in the OS file manager
  }
  ship: {
    finalize(job: number, targetDir?: string): Promise<string> // copies the ship job's staged final into targetDir or the schematics folder
    results(build: string, title: string, rows: [string, string][]): Promise<void> // a table in the DESIGN.md log
    commit(build: string, message: string): Promise<ShipCommitResult> // git, builds/<name> only; succeeds cleanly if nothing changed
    reveal(path: string): Promise<void> // reveals an exported file in the OS file manager
  }
  render: {
    copyImage(data: Uint8Array): Promise<void>
    saveImage(
      defaultName: string,
      format: RenderImageFormat,
      data: Uint8Array
    ): Promise<string | null>
    saveBatch(
      files: { name: string; data: Uint8Array }[]
    ): Promise<{ dir: string; count: number } | null>
    saveBuildPreview(
      build: string,
      versionPath: string,
      kind: 'thumbnail' | 'sheet',
      data: Uint8Array
    ): Promise<string>
    reveal(path: string): Promise<void> // reveals a saved render file or batch folder in the OS file manager
  }
  app: {
    report(s: AppState): void // what the user has open, for the MCP status() tool
    onShow(cb: (v: { path: string; build: string }) => void): () => void // MCP show(path)
    onSheet(cb: (v: { path: string; build: string }) => void): () => void // the agent's show_sheet(path)
  }
  updater: {
    get(): Promise<{ version: string; state: UpdateState }> // version: the running app's
    check(): Promise<void>
    install(): Promise<void> // quits, installs the downloaded version, relaunches
    notices(): Promise<void> // opens THIRD_PARTY_NOTICES.txt
    onState(cb: (s: UpdateState) => void): () => void
  }
  agent: {
    diagnose(): Promise<ProviderDiagnostic[]>
    login(): Promise<void> // Codex only: Sign in with ChatGPT
    cancelLogin(): Promise<void>
    hasApiKey(): Promise<boolean> // whether an Anthropic API key is saved; the key is never sent back
    setApiKey(key: string): Promise<void> // '' removes it
    send(thread: string, a: AgentSend): Promise<string | undefined>
    interrupt(thread: string): Promise<void>
    close(thread: string): Promise<void> // ends the thread's live session; it stays resumable
    configure(thread: string, model: string | null, effort: Effort | null): Promise<void> // its live session too
    setMode(thread: string, mode: AgentMode): Promise<void>
    state(): Promise<{ primary: AgentState; threads: Record<string, AgentState> }>
    pending(): Promise<{ thread: string; ask: PermissionAsk }[]>
    permit(thread: string, p: Permit): Promise<void>
    sessions(build: string): Promise<AgentSession[]> // tagged with the build, newest first
    history(ref: SessionRef): Promise<AgentMsg[]>
    fork(ref: SessionRef, build: string, point?: string): Promise<SessionRef>
    rewindPoints(ref: SessionRef): Promise<AgentRewindPoint[]>
    rewindPreview(ref: SessionRef, build: string, point: string): Promise<AgentRewindPreview>
    rewind(
      ref: SessionRef,
      build: string,
      point: string,
      files: string[] | null
    ): Promise<SessionRef | null>
    rename(ref: SessionRef, title: string): Promise<void>
    remove(ref: SessionRef): Promise<void> // Claude deletes the transcript, Codex archives the thread
    models(): Promise<AgentModel[]>
    commands(thread: string | null): Promise<AgentCommand[]>
    mcp(thread: string): Promise<McpStatus[]> // [] until the thread has a live session
    mcpToggle(thread: string, name: string, enabled: boolean): Promise<void>
    attach(build: string, name: string, data: Uint8Array): Promise<string> // builds/<b>/attachments/…
    onMsg(cb: (e: ThreadEvent<AgentMsg>) => void): () => void
    onState(cb: (e: ThreadEvent<AgentState>) => void): () => void
    onAsk(cb: (e: ThreadEvent<PermissionAsk | { done: string }>) => void): () => void
  }
  variants: {
    start(v: VariantStart): Promise<void>
    send(lane: string, text: string): Promise<void> // a follow-up to one lane
    interrupt(lane: string): Promise<void>
    close(): Promise<void> // ends every lane's live query
    state(): Promise<Record<string, AgentState>>
    pending(): Promise<{ lane: string; ask: PermissionAsk }[]>
    permit(lane: string, p: Permit): Promise<void>
    onMsg(cb: (e: LaneEvent<AgentMsg>) => void): () => void
    onState(cb: (e: LaneEvent<AgentState>) => void): () => void
    onAsk(cb: (e: LaneEvent<PermissionAsk | { done: string }>) => void): () => void
  }
  refs: {
    list(build: string): Promise<Ref[]>
    add(build: string, ref: RefAdd): Promise<Ref>
    note(build: string, id: string, note: string): Promise<void>
    update(build: string, id: string, patch: RefUpdate): Promise<Ref>
    remove(build: string, id: string): Promise<void> // its image to the Recycle Bin
  }
  blocks: {
    /** Every block of a Minecraft version; null without build tools or for a version they do not know. */
    list(minecraftVersion: string): Promise<BlockInfo[] | null>
  }
  edits: {
    read(build: string): Promise<EditsFile | null> // null: no hand edits
    save(build: string, edits: EditsFile): Promise<void> // no cells removes the file
  }
  site: {
    worlds(): Promise<{ name: string; path: string }[]> // saves folders with a level.dat
    pick(): Promise<string | null> // a folder dialog
    inspect(world: string): Promise<WorldInfo>
    readMeta(build: string): Promise<SitePlacement | null>
    saveMeta(
      build: string,
      placement: SitePlacement,
      updateBuildOrigin?: boolean
    ): Promise<{ originUpdated: boolean }>
  }
  bridge: {
    call<M extends BridgeMethod>(
      method: M,
      params?: BridgeMethods[M]['params'],
      onProgress?: (progress: BridgeProgress) => void,
      minecraftVersion?: string
    ): Promise<BridgeMethods[M]['result']>
    log(): Promise<string[]>
  }
  /** Dev performance numbers; main answers only in development or with BS_PERF=1, otherwise it rejects. */
  perf: {
    sample(): Promise<PerfSample>
  }
}

export interface PerfProcess {
  /** Electron's process type: Browser (main), Tab (renderer), GPU, Utility, ... */
  type: string
  name?: string
  pid: number
  /** CPU % since the previous sample (one core = 100). */
  cpu: number
  /** Working set and private bytes, KB. */
  workingSetKB: number
  privateKB?: number
}

export interface PerfSample {
  /** ms since the main process started. */
  uptime: number
  /** Boot milestones, ms since the main process started. */
  marks: Record<string, number>
  processes: PerfProcess[]
  /** Main process heap, bytes. */
  mainHeapUsed: number
}

/** Invoke channels: `${group}:${name}`. */
export const CHANNELS = [
  'window:state',
  'window:minimize',
  'window:toggleMaximize',
  'window:close',
  'setup:suggestion',
  'setup:prepare',
  'runtime:delivery',
  'setup:progress',
  'setup:pickFile',
  'availability:get',
  'workspace:pick',
  'workspace:open',
  'workspace:bootstrap',
  'workspace:preview',
  'workspace:import',
  'workspace:cancel',
  'workspace:recover',
  'workspace:state',
  'builds:create',
  'builds:upgrade',
  'minecraft:installations',
  'minecraft:pack',
  'schematic:choose',
  'schematic:inspect',
  'schematic:commit',
  'schematic:cancel',
  'settings:get',
  'runtime:state',
  'runtime:diagnose',
  'runtime:install',
  'runtime:cancel',
  'runtime:identity',
  'settings:set',
  'settings:checkPaths',
  'settings:detected',
  'builds:list',
  'builds:deleteVersion',
  'builds:rename',
  'builds:archive',
  'builds:outSize',
  'jobs:run',
  'jobs:cancel',
  'jobs:list',
  'review:list',
  'review:save',
  'review:cancel',
  'review:pending',
  'design:read',
  'design:write',
  'design:reveal',
  'ship:finalize',
  'ship:results',
  'ship:commit',
  'ship:reveal',
  'render:copyImage',
  'render:saveImage',
  'render:saveBatch',
  'render:saveBuildPreview',
  'render:reveal',
  'app:report',
  'updater:get',
  'updater:check',
  'updater:notices',
  'updater:install',
  'refs:list',
  'refs:add',
  'refs:note',
  'refs:update',
  'refs:remove',
  'blocks:list',
  'edits:read',
  'edits:save',
  'site:worlds',
  'site:pick',
  'site:inspect',
  'site:readMeta',
  'site:saveMeta',
  'bridge:call',
  'bridge:log',
  'agent:send',
  'agent:diagnose',
  'agent:login',
  'agent:cancelLogin',
  'agent:hasApiKey',
  'agent:setApiKey',
  'agent:interrupt',
  'agent:close',
  'agent:configure',
  'agent:state',
  'agent:pending',
  'agent:permit',
  'agent:sessions',
  'agent:history',
  'agent:fork',
  'agent:rewindPoints',
  'agent:rewindPreview',
  'agent:rewind',
  'agent:rename',
  'agent:models',
  'agent:setMode',
  'agent:remove',
  'agent:commands',
  'agent:mcp',
  'agent:mcpToggle',
  'agent:attach',
  'variants:start',
  'variants:send',
  'variants:interrupt',
  'variants:close',
  'variants:state',
  'variants:pending',
  'variants:permit',
  'perf:sample'
] as const
export type Channel = (typeof CHANNELS)[number]
