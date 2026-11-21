import { useState, type ReactElement } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/shared/ui/primitives/input'
import { forceFocus, Guidance, LONG, RTL_TEXT, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Input' }

export default function InputSection(): ReactElement {
  const [search, setSearch] = useState('oak_planks')
  return (
    <div className="flex flex-col gap-6">
      <Specimens className="*:w-56">
        <Specimen label="empty, placeholder">
          <Input aria-label="Build name" placeholder="Build name" />
        </Specimen>
        <Specimen label="filled">
          <Input aria-label="Build name" defaultValue="watchtower" />
        </Specimen>
        <Specimen label="focus">
          <Input aria-label="Build name" defaultValue="watchtower" className={forceFocus} tabIndex={-1} />
        </Specimen>
        <Specimen label="invalid">
          <Input aria-label="Build name" defaultValue="watch tower!" aria-invalid />
        </Specimen>
        <Specimen label="disabled">
          <Input aria-label="Build name" defaultValue="watchtower" disabled />
        </Specimen>
        <Specimen label="read-only">
          <Input aria-label="Workspace" defaultValue="D:\Builds\workspace" readOnly className="font-mono text-sm" />
        </Specimen>
        <Specimen label="long text">
          <Input aria-label="Long" defaultValue={LONG} />
        </Specimen>
        <Specimen label="RTL">
          <Input aria-label="RTL" dir="rtl" defaultValue={RTL_TEXT} />
        </Specimen>
      </Specimens>
      <Specimens title="Slots" className="*:w-56">
        <Specimen label="leading icon + clear">
          <Input
            aria-label="Search blocks"
            placeholder="Search blocks"
            leading={<SearchIcon aria-hidden />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </Specimen>
        <Specimen label="trailing unit">
          <Input aria-label="Width" defaultValue="32" trailing="blocks" className="font-mono" />
        </Specimen>
        <Specimen label="invalid group">
          <Input aria-label="Seed" defaultValue="abc" trailing="seed" aria-invalid />
        </Specimen>
        <Specimen label="disabled group">
          <Input aria-label="Search" placeholder="Search" leading={<SearchIcon aria-hidden />} disabled />
        </Specimen>
        <Specimen label="file">
          <Input aria-label="Reference image" type="file" />
        </Specimen>
      </Specimens>
      <Guidance>
        Wrap inputs in a Field for the label, hint and error. The clear button returns focus to the input.
      </Guidance>
    </div>
  )
}
