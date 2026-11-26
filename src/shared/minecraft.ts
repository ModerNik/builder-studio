import versions from './minecraft-versions.json'

export const MINECRAFT_VERSIONS = versions as readonly string[]
export const DEFAULT_MINECRAFT_VERSION = '26.3'

export const EXPORT_FORMATS = ['litematic', 'schem', 'nbt', 'schematic'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export interface ExportFormatInfo {
  readonly id: ExportFormat
  readonly extension: string
  readonly label: string
  readonly description: string
}

export const EXPORT_FORMAT_INFO: Record<ExportFormat, ExportFormatInfo> = {
  litematic: {
    id: 'litematic',
    extension: '.litematic',
    label: 'Litematica',
    description: '1.14+ · Litematica mod'
  },
  schem: {
    id: 'schem',
    extension: '.schem',
    label: 'Sponge',
    description: '1.13+ · WorldEdit / Axiom'
  },
  nbt: {
    id: 'nbt',
    extension: '.nbt',
    label: 'Structure',
    description: '1.13+ · Vanilla / Datapacks'
  },
  schematic: {
    id: 'schematic',
    extension: '.schematic',
    label: 'Legacy',
    description: '1.12.x · MCEdit / WorldEdit'
  }
}

export function isMinecraftVersion(version: string): boolean {
  return MINECRAFT_VERSIONS.includes(version)
}

/** Supported export formats for a Minecraft version, default first (matches mcb.export.supported_formats). */
export function supportedExportFormats(version: string): readonly ExportFormat[] {
  if (version.startsWith('1.12')) return ['schematic']
  if (version.startsWith('1.13')) return ['schem', 'nbt']
  return ['litematic', 'schem', 'nbt']
}

export function defaultExportFormat(version: string): ExportFormat {
  return supportedExportFormats(version)[0]
}
