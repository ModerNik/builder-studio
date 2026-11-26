// Settings › Minecraft: pure helpers for visible and addable game-file versions.
import type { Settings } from '@shared/api'
import { MINECRAFT_VERSIONS } from '@shared/minecraft'

export type MinecraftFilesMap = NonNullable<Settings['minecraftFiles']>

/** Versions shown in Settings › Minecraft: the default target plus explicitly configured overrides, newest first. */
export function visibleMinecraftVersions(
  target: string,
  configured: MinecraftFilesMap | undefined
): string[] {
  return [...new Set([target, ...Object.keys(configured ?? {})])].sort(
    (a, b) => MINECRAFT_VERSIONS.indexOf(b) - MINECRAFT_VERSIONS.indexOf(a)
  )
}

/** Supported versions not yet listed, in chronological order (MinecraftVersionSelect reverses them). */
export function addableMinecraftVersions(visible: readonly string[]): string[] {
  const shown = new Set(visible)
  return MINECRAFT_VERSIONS.filter((version) => !shown.has(version))
}

/** Preselected version when opening Add version: newest detected installation not yet listed, else newest addable. */
export function defaultAddVersion(
  addable: readonly string[],
  installed: readonly { version: string; jar: string }[]
): string {
  const detected = new Set(installed.map((item) => item.version))
  for (let i = addable.length - 1; i >= 0; i--) {
    if (detected.has(addable[i])) return addable[i]
  }
  return addable.at(-1) ?? ''
}

/** Adds or replaces a version's file overrides, trimming whitespace and omitting blank fields. */
export function withVersionFiles(
  configured: MinecraftFilesMap | undefined,
  version: string,
  files: { jar?: string; pack?: string }
): MinecraftFilesMap {
  const jar = files.jar?.trim()
  const pack = files.pack?.trim()
  const entry: { jar?: string; pack?: string } = {}
  if (jar) entry.jar = jar
  if (pack) entry.pack = pack
  return { ...configured, [version]: entry }
}

/** Removes a version's explicit override entry from minecraftFiles. */
export function withoutVersionFiles(
  configured: MinecraftFilesMap | undefined,
  version: string
): MinecraftFilesMap {
  const next: MinecraftFilesMap = { ...configured }
  delete next[version]
  return next
}
