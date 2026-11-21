import versions from './minecraft-versions.json'

export const MINECRAFT_VERSIONS = versions as readonly string[]
export const DEFAULT_MINECRAFT_VERSION = '26.3'

export function isMinecraftVersion(version: string): boolean {
  return MINECRAFT_VERSIONS.includes(version)
}
