import type { Feature, JobSpec, Repair, Requirement } from './api'

export const SETUP_REQUIREMENTS: Requirement[] = [
  'workspace',
  'engine',
  'git',
  'browser',
  'export',
  'identity'
]

export const FEATURE_REQUIREMENTS: Record<Feature, Requirement[]> = {
  browse: ['workspace'],
  engine: ['workspace', 'engine'],
  viewer: ['workspace', 'pack'],
  render: ['workspace', 'engine', 'pack', 'browser'],
  proto: ['workspace', 'engine'],
  export: ['workspace', 'export'],
  ai: ['workspace', 'ai'],
  variants: ['workspace', 'ai'],
  newBuild: ['workspace', 'engine', 'git'],
  commit: ['workspace', 'git', 'identity']
}
export const REQUIREMENT_REPAIR: Record<Requirement, Repair> = {
  workspace: 'workspace',
  engine: 'runtime',
  pack: 'minecraft',
  browser: 'runtime',
  export: 'minecraft',
  ai: 'ai',
  git: 'runtime',
  identity: 'runtime'
}
export function jobFeature(spec: JobSpec): Feature {
  if (spec.part === 'proto') return spec.noRender ? 'proto' : 'render'
  return spec.part === 'full' && !spec.noRender ? 'render' : 'engine'
}
