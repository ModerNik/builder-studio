/** "minecraft:oak_stairs[facing=east,half=top]" → "oak_stairs" and its properties. */
export function splitState(state: string): { id: string; props: string } {
  const [id, rest = ''] = state.replace(/^minecraft:/, '').split('[')
  return { id, props: rest.replace(/]$/, '').replaceAll(',', ', ') }
}
