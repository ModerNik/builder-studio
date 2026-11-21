export interface ComparedVersion {
  path: string
  mtime: number
  minecraftVersion?: string
}

export function toggleComparedVersion(selected: string[], path: string): string[] {
  if (selected.includes(path)) return selected.filter((item) => item !== path)
  return selected.length < 4 ? [...selected, path] : selected
}

export function comparisonBaseline(
  versions: ComparedVersion[],
  version: ComparedVersion | null,
  selected: string | null
): ComparedVersion | null {
  if (!version) return null
  const others = versions
    .filter((item) => item.path !== version.path)
    .sort((a, b) => b.mtime - a.mtime)
  return (
    others.find((item) => item.path === selected) ??
    others.find((item) => item.mtime < version.mtime) ??
    others[0] ??
    null
  )
}
