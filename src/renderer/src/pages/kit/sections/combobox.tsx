import { useEffect, useState, type ReactElement } from 'react'
import { Combobox, type ComboboxOption } from '@/shared/ui/primitives/combobox'
import { Field } from '@/shared/ui/primitives/field'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Combobox' }

const blocks: ComboboxOption[] = [
  'oak_planks',
  'spruce_planks',
  'stone_bricks',
  'deepslate_tiles',
  'cut_copper',
  'weathered_copper',
  'oxidized_cut_copper',
  'glass_pane',
  'lantern',
  'chain'
].map((id) => ({
  value: id,
  label: id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
  description: `minecraft:${id}`,
  keywords: [id]
}))
blocks.push({ value: 'barrier', label: 'Barrier', description: 'Not allowed in builds', disabled: true })

export default function ComboboxSection(): ReactElement {
  const [block, setBlock] = useState<string | null>('cut_copper')
  const [remote, setRemote] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ComboboxOption[]>(blocks)
  const [loading, setLoading] = useState(true)

  // a fake server: 600ms per search
  useEffect(() => {
    const t = setTimeout(() => {
      setResults(blocks.filter((b) => b.value.includes(query.toLowerCase().replace(/ /g, '_'))))
      setLoading(false)
    }, 600)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="flex flex-col gap-6">
      <Specimens className="*:w-64">
        <Specimen label="local filter">
          <Combobox aria-label="Block" options={blocks} value={block} onValueChange={setBlock} />
        </Specimen>
        <Specimen label="async (600ms fake search)">
          <Combobox
            aria-label="Block (async)"
            options={results}
            value={remote}
            onValueChange={setRemote}
            onSearchChange={(q) => {
              setLoading(true)
              setQuery(q)
            }}
            loading={loading}
            placeholder="Search the block list"
            clearable
          />
        </Specimen>
        <Specimen label="disabled">
          <Combobox aria-label="Disabled" options={blocks} value="lantern" onValueChange={() => {}} disabled />
        </Specimen>
        <Specimen label="in a Field with an error">
          <Field label="Roof block" error="Pick a block for the roof" required className="w-full">
            <Combobox options={blocks} value={null} onValueChange={() => {}} />
          </Field>
        </Specimen>
        <Specimen label="empty list">
          <Combobox aria-label="Empty" options={[]} value={null} onValueChange={() => {}} emptyText="No blocks in this palette" />
        </Specimen>
      </Specimens>
      <Guidance>
        Opens on Enter, Space or click; type to filter, arrows to move, Enter to pick, Esc to close (focus
        returns to the trigger). For async lists pass onSearchChange and loading, and supply the filtered
        options yourself.
      </Guidance>
    </div>
  )
}
