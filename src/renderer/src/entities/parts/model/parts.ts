// The Parts tab's context for the agent: which ops of a draft are selected, where their code is, what to leave alone.
import { create } from 'zustand'
import type { PartInfo } from '@shared/api'

/** A text block naming each part's blocks, inclusive cell box and the build code that opened it. */
export function partsContext(version: string, parts: PartInfo[]): string {
  const lines = parts.map((p) => {
    const [lo, hi] = p.box
    const box = 'xyz'
      .split('')
      .map((a, i) => `${a} ${lo[i]}–${hi[i]}`)
      .join(' ')
    const at = p.sources.map(([file, line, fn]) => `${file}:${line} in ${fn}()`).join(', ')
    const name = p.name === '-' ? 'untagged (written outside any c.op)' : `"${p.name}"`
    return `- ${name}: ${p.blocks} blocks, ${box}${at ? `; opened at ${at}` : ''}`
  })
  return [
    `Selected parts of ${version}:`,
    ...lines,
    "Change only these parts; leave other parts' output unchanged. Line numbers are from the run that wrote this file."
  ].join('\n')
}

/** A click on a part: alone it selects just that part (or clears it when it was the only one); with add (shift) it
 *  toggles the part in or out of the selection. */
export function pickPart(selected: string[], name: string, add: boolean): string[] {
  if (add) return selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]
  return selected.length === 1 && selected[0] === name ? [] : [name]
}

/** The parts the Parts tab's Ask agent handed to the composer, shown there as a chip until sent or removed. */
export const useAskParts = create<{
  ask: { build: string; version: string; parts: PartInfo[] } | null
}>(() => ({ ask: null }))
