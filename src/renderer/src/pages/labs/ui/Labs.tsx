// Labs (G6-4-LB, tool cards on page tabs): tools for looking things up while designing. Palette puts each
// tool in its own card (Ramp first and full width, Nearest and Blend side by side, Styles folded under them)
// with results as palette strips on viewer grey; Kit catalog is docs/catalog.md beside tools/catalog.py's scene
// sheets; Prefabs is assets/index.json as copyable tiles. Everything is read-only.
import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, FlaskConical, PackageSearch } from 'lucide-react'
import { toast } from 'sonner'
import type { PaletteCheck } from '@shared/api'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { ColourField } from '@/shared/ui/primitives/colour-field'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/ui/primitives/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/shared/ui/primitives/collapsible'
import { PaletteStrip, type PaletteBlock } from '@/shared/ui/data/PaletteStrip'
import { PrefabTile } from '@/shared/ui/data/ImageCards'
import { CardGrid } from '@/shared/ui/layout/Grids'
import { SplitView } from '@/shared/ui/layout/SplitView'
import { Prose } from '@/shared/ui/code/Prose'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { assetUrl, buildUrl } from '@/shared/lib/urls'
import { useAvailability, useBridge } from '@/entities/availability/model/availability'
import { useBlockColors } from '@/entities/build/model/blocks'
import { useSettings } from '@/entities/settings/model/settings'
import { useSpriteCell } from '@/pages/labs/model/sprites'
import { useCatalogDoc, useLabsTab, usePrefabIndex, type Piece } from '../model/labs'
import { errorText } from '@/entities/build/model/workspace'
import { short } from '@/shared/lib/format'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'

export function Labs(): ReactElement {
  const { tab, pick } = useLabsTab()
  const engine = useAvailability().data?.features.engine.ok
  return (
    <Tabs value={tab} onValueChange={pick} className="flex h-full min-w-0 flex-col gap-0">
      <div className="flex shrink-0 items-end gap-4 border-b border-border-subtle px-4 pt-3 sm:px-6">
        <h1 className="sr-only">Labs</h1>
        <TabsList variant="line" aria-label="Labs" className="h-11 border-b-0">
          <TabsTrigger value="palette">Palette</TabsTrigger>
          <TabsTrigger value="catalog">Kit catalog</TabsTrigger>
          <TabsTrigger value="prefabs">Prefabs</TabsTrigger>
        </TabsList>
      </div>
      {engine === false ? (
        <NoEngine />
      ) : (
        <>
          <TabsContent value="palette" className="min-h-0 flex-1 overflow-y-auto">
            <Palette />
          </TabsContent>
          <TabsContent value="catalog" className="min-h-0 flex-1 overflow-y-auto">
            <Catalog />
          </TabsContent>
          <TabsContent value="prefabs" className="min-h-0 flex-1 overflow-y-auto">
            <Prefabs />
          </TabsContent>
        </>
      )}
    </Tabs>
  )
}

function NoEngine(): ReactElement {
  const navigate = useNavigate()
  return (
    <EmptyState
      icon={FlaskConical}
      size="page"
      title="Labs needs the build engine"
      action={
        <Button onClick={() => void navigate({ to: '/settings', search: { section: 'tools' } })}>
          Open Settings › Engine
        </Button>
      }
    >
      Palette lookups and the prefab index come from the Python engine, which isn’t installed yet.
    </EmptyState>
  )
}

const words = (s: string): string[] =>
  s
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(short)
const copy = (s: string): void =>
  void navigator.clipboard.writeText(s).then(() => toast.success(`Copied ${s}`))

/** Blocks as a palette strip with their measured colours; a tile click copies the name. */
function Strip({
  blocks,
  L,
  label,
  check,
  summary,
  size
}: {
  blocks: string[]
  L?: number[]
  label: string
  check?: boolean
  summary?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}): ReactElement {
  const colors = useBlockColors().data
  const list: PaletteBlock[] = blocks.map((b, i) => {
    const c = colors?.[`minecraft:${short(b)}`]
    return {
      id: short(b),
      color: c ? `rgb(${c.map((v) => Math.round(v * 255)).join(' ')})` : null,
      l: L?.[i]
    }
  })
  return (
    <PaletteStrip
      blocks={list}
      label={label}
      check={check && !!L}
      summary={summary}
      size={size}
      onSelect={copy}
    />
  )
}

function checkLine(c: PaletteCheck): ReactNode {
  return (
    <>
      Range {c.range.toFixed(2)}, hue swing {c.hue_swing}°
      {c.problems.length ? (
        <span className="text-warning-text"> · {c.problems.join(' · ')}</span>
      ) : (
        <span className="text-success-text"> · reads clean</span>
      )}
    </>
  )
}

function Tool({
  title,
  description,
  children,
  className
}: {
  title: string
  description: string
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

const failed = (q: { error: unknown }): ReactNode =>
  q.error ? <InlineNotice tone="danger">{errorText(q.error)}</InlineNotice> : null
const pending = (on: boolean): ReactNode =>
  on ? (
    <div className="flex gap-1 rounded-lg bg-surface-viewer p-2" aria-busy="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 w-16" />
      ))}
    </div>
  ) : null

function Palette(): ReactElement {
  const minecraftVersion = useSettings().data?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const pool = useBridge('palette_blocks', {}, minecraftVersion)
  const [ramp, setRamp] = useState(
    'stone cobblestone andesite tuff deepslate polished_andesite calcite'
  )
  const [lightFirst, setLightFirst] = useState(false)
  const [rampQ, setRampQ] = useState<{ blocks: string[]; light_first: boolean } | null>(null)
  const [hex, setHex] = useState('#8a6a4a')
  const [block, setBlock] = useState('')
  const [near, setNear] = useState<{ target: string | number[]; k: number } | null>(null)
  const [blend, setBlend] = useState({ a: 'stone_bricks', b: 'mossy_cobblestone', n: 5 })
  const [blendQ, setBlendQ] = useState<typeof blend | null>(null)
  const [stylesOpen, setStylesOpen] = useState(false)
  const r = useBridge('palette_ramp', rampQ, minecraftVersion)
  const nr = useBridge('palette_nearest', near, minecraftVersion)
  const bl = useBridge('palette_blend', blendQ, minecraftVersion)
  const styles = useBridge('styles', {}, minecraftVersion)
  const colors = useBlockColors().data
  const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const nearest = (): void =>
    setNear(block.trim() ? { target: short(block.trim()), k: 10 } : { target: rgb(hex), k: 10 })
  const nearTo = near ? (typeof near.target === 'string' ? near.target : hex) : ''
  const sheets = Object.entries(styles.data ?? {})

  return (
    <div className="mx-auto flex max-w-300 flex-col gap-6 p-4 sm:p-6">
      <datalist id="blocks">
        {pool.data?.blocks.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <h2 className="sr-only">Palette tools</h2>
      <Tool title="Ramp" description="Orders blocks dark to light and checks each step.">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            aria-label="Blocks to ramp"
            value={ramp}
            onChange={(e) => setRamp(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && setRampQ({ blocks: words(ramp), light_first: lightFirst })
            }
            className="min-w-60 flex-1 font-mono"
            list="blocks"
          />
          <label className="flex items-center gap-2">
            <Checkbox checked={lightFirst} onCheckedChange={(v) => setLightFirst(v === true)} />
            Light first
          </label>
          <Button
            disabled={r.isFetching}
            onClick={() => setRampQ({ blocks: words(ramp), light_first: lightFirst })}
          >
            {r.isFetching ? 'Ramping…' : 'Ramp'}
          </Button>
        </div>
        {r.isFetching
          ? pending(true)
          : r.data && (
              <Strip
                blocks={r.data.blocks}
                L={r.data.check.L}
                label="Ramp, dark to light"
                check
                summary={checkLine(r.data.check)}
              />
            )}
        {failed(r)}
      </Tool>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tool title="Nearest" description="Blocks closest to a color or to another block.">
          <div className="flex flex-wrap items-center gap-2">
            <ColourField value={hex} onChange={setHex} />
            <span className="text-sm text-fg-muted">or</span>
            <Input
              aria-label="Block"
              placeholder="a block, Enter"
              list="blocks"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nearest()}
              className="w-48 font-mono"
            />
            <Button disabled={nr.isFetching} onClick={nearest}>
              {nr.isFetching ? 'Looking…' : 'Nearest'}
            </Button>
          </div>
          {nr.isFetching
            ? pending(true)
            : nr.data && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Nearest to {nearTo}</h3>
                  <Strip blocks={nr.data.blocks} label={`Nearest to ${nearTo}`} size="sm" />
                </div>
              )}
          {failed(nr)}
        </Tool>

        <Tool title="Blend" description="Steps from one block to another (2 to 12).">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="From block"
              value={blend.a}
              onChange={(e) => setBlend({ ...blend, a: e.target.value })}
              list="blocks"
              className="w-44 font-mono"
            />
            <span aria-hidden>→</span>
            <Input
              aria-label="To block"
              value={blend.b}
              onChange={(e) => setBlend({ ...blend, b: e.target.value })}
              list="blocks"
              className="w-44 font-mono"
            />
            <NumberField
              aria-label="Steps"
              className="w-24"
              min={2}
              max={12}
              value={blend.n}
              onValueChange={(v) =>
                setBlend({ ...blend, n: Math.max(2, Math.min(12, Math.round(v ?? 5))) })
              }
            />
            <Button
              disabled={bl.isFetching}
              onClick={() =>
                setBlendQ({ a: short(blend.a.trim()), b: short(blend.b.trim()), n: blend.n })
              }
            >
              {bl.isFetching ? 'Blending…' : 'Blend'}
            </Button>
          </div>
          {bl.isFetching
            ? pending(true)
            : bl.data && (
                <Strip
                  blocks={bl.data.blocks}
                  L={bl.data.check.L}
                  label={`Blend from ${blendQ?.a} to ${blendQ?.b}`}
                  size="sm"
                  summary={checkLine(bl.data.check)}
                />
              )}
          {failed(bl)}
        </Tool>
      </div>

      <Collapsible open={stylesOpen} onOpenChange={setStylesOpen} className="flex flex-col gap-4">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-baseline gap-2 self-start rounded-md text-left font-medium focus-ring"
          >
            <ChevronDown
              aria-hidden
              className={`size-4 self-center transition-transform duration-fast ${stylesOpen ? '' : '-rotate-90'}`}
            />
            Styles
            <span className="text-sm font-normal text-fg-muted">
              {sheets.length} sheets from mcb.styles
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {failed(styles)}
          <CardGrid min="22rem">
            {sheets.map(([name, s]) => (
              <Card key={name} aria-label={`Style ${name}`} className="gap-3 p-4">
                <h3 className="font-mono font-medium">{name}</h3>
                {s.swatch ? (
                  <img
                    src={buildUrl(s.swatch)}
                    alt={`${name} swatch`}
                    className="w-full rounded-md"
                  />
                ) : (
                  <p className="grid h-50 place-items-center rounded-md bg-surface-viewer text-sm text-fg-muted">
                    No swatch rendered yet.
                  </p>
                )}
                <dl className="grid grid-cols-[4rem_1fr] items-center gap-x-3 gap-y-2">
                  {Object.entries(s)
                    .filter(([k]) => k !== 'swatch')
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-sm text-fg-muted">{k}</dt>
                        <dd className="min-w-0">
                          {Array.isArray(v) ? (
                            <Strip
                              blocks={v.map((x) => String(Array.isArray(x) ? x[0] : x))}
                              label={`${name} ${k}`}
                              size="sm"
                            />
                          ) : colors?.[`minecraft:${v}`] ? (
                            <Strip blocks={[String(v)]} label={`${name} ${k}`} size="sm" />
                          ) : (
                            <span className="text-sm">{String(v)}</span>
                          )}
                        </dd>
                      </div>
                    ))}
                </dl>
              </Card>
            ))}
          </CardGrid>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

const CATALOG_CMD = 'python -m tools.catalog'

function Catalog(): ReactElement {
  const minecraftVersion = useSettings().data?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const cat = useBridge('catalog', {}, minecraftVersion)
  const md = useCatalogDoc(cat.data)
  if (cat.error)
    return (
      <ErrorState
        title="Can’t read the kit catalog"
        error={cat.error}
        onRetry={() => void cat.refetch()}
        retryLabel="Try again"
      />
    )
  const sheets = cat.data?.sheets ?? []
  return (
    <SplitView
      preset="detail-aside"
      labels={['Kit catalog', 'Scene sheets']}
      className="p-4 sm:p-6"
      first={
        md.error ? (
          <ErrorState
            title="Can’t read docs/catalog.md"
            error={md.error}
            onRetry={() => void md.refetch()}
            retryLabel="Try again"
          />
        ) : md.data ? (
          <Prose variant="docs" className="max-w-155">
            {md.data}
          </Prose>
        ) : (
          <LoadingState label="Reading docs/catalog.md" layout="detail" />
        )
      }
      second={
        <div className="flex flex-col gap-4">
          <h2 className="font-medium">Scene sheets</h2>
          {cat.isPending ? (
            <Skeleton className="aspect-square w-full" />
          ) : !sheets.length ? (
            <div className="flex flex-col gap-2">
              <InlineNotice>
                No scene sheets yet. Render them with the configured Python:
              </InlineNotice>
              <div className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-sunken ps-3">
                <code className="flex-1 font-mono text-sm">{CATALOG_CMD}</code>
                <CopyButton text={CATALOG_CMD} label="Copy command" />
              </div>
            </div>
          ) : (
            sheets.map((s) => (
              <figure key={s} className="flex flex-col gap-1">
                <figcaption className="font-mono text-sm text-fg-muted">
                  {s.split('/').at(-2)?.replace(/_3d$/, '')}
                </figcaption>
                <img src={buildUrl(s)} alt={s} className="w-full rounded-md" />
              </figure>
            ))
          )}
        </div>
      }
    />
  )
}

const PAGE = 120
const ALL = '__all'

function Prefabs(): ReactElement {
  const index = usePrefabIndex()
  const [category, setCategory] = useState(ALL)
  const [kind, setKind] = useState(ALL)
  const [text, setText] = useState('')
  const [shown, setShown] = useState(PAGE)
  const kinds = useMemo(
    () => [...new Set(index.data?.pieces.map((p) => p.kind))].sort(),
    [index.data]
  )
  const hits = useMemo(() => {
    const t = text.trim().toLowerCase()
    return (index.data?.pieces ?? []).filter(
      (p) =>
        (category === ALL || p.category === category) &&
        (kind === ALL || p.kind === kind) &&
        (!t || p.id.toLowerCase().includes(t) || p.top.some((b) => b.includes(t)))
    )
  }, [index.data, category, kind, text])
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setShown(PAGE)
    }

  if (index.error)
    return (
      <ErrorState
        title="Can’t read the prefab index assets/index.json"
        error={index.error}
        onRetry={() => void index.refetch()}
        retryLabel="Try again"
      />
    )
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={reset(setCategory)}>
          <SelectTrigger aria-label="Category" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {Object.entries(index.data?.summary ?? {}).map(([c, n]) => (
              <SelectItem key={c} value={c}>
                {c} ({n})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={reset(setKind)}>
          <SelectTrigger aria-label="Kind" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All kinds</SelectItem>
            {kinds.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Filter by file or block"
          value={text}
          onChange={(e) => reset(setText)(e.target.value)}
          placeholder="file or block, e.g. oak or spruce_log"
          className="w-72"
        />
        <span className="text-sm text-fg-secondary tabular-nums">
          {hits.length} of {index.data?.pieces.length ?? '…'} · click a piece to copy its id
        </span>
      </div>
      {index.isPending ? (
        <LoadingState label="Reading the prefab index" layout="cards" rows={6} />
      ) : !hits.length ? (
        <EmptyState
          icon={PackageSearch}
          size="panel"
          variant="no-results"
          title={text.trim() ? `No pieces use ${text.trim()}` : 'No pieces match'}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setCategory(ALL)
                setKind(ALL)
                setText('')
              }}
            >
              Clear filters
            </Button>
          }
        >
          Try another block or category.
        </EmptyState>
      ) : (
        <CardGrid min="11.25rem" className="gap-3">
          {hits.slice(0, shown).map((p) => (
            <Prefab key={p.id} p={p} />
          ))}
        </CardGrid>
      )}
      {shown < hits.length && (
        <Button variant="outline" className="self-start" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, hits.length - shown)} more
        </Button>
      )}
    </div>
  )
}

function Prefab({ p }: { p: Piece }): ReactElement {
  const image = useSpriteCell(assetUrl(p.sheet), p.number % 36)
  return (
    <PrefabTile
      name={p.file.split('/').pop() ?? p.id}
      image={image}
      blocks={p.blocks}
      warnings={p.warnings.length}
      copyText={`assets/${p.id}`}
      tooltip={
        <span className="flex flex-col">
          <span className="font-mono">{p.size.join('×')}</span>
          <span>{p.top.join(', ')}</span>
          {p.warnings.length > 0 && <span>{p.warnings.join('; ')}</span>}
        </span>
      }
    />
  )
}
