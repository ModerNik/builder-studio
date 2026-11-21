// The renderer module: the app imports it directly, and `npm run build:renderer-lib` bundles it (three included)
// for the engine's headless tools/render/viewer.html.
export * as THREE from 'three'
export {
  Renderer,
  SchematicObject,
  CameraManager,
  type Projection,
  type SSAOPreset
} from './renderer'
export { loadResources, acquireResources, releaseResources, type Resources } from './resources'
export { readSchematic, blockAt, isAir, type Schematic, type Vec3 } from './schematic'
export { applyLook, DEFAULT_LOOK, type Look, type LookOptions, type Scene } from './look'
export type { BlockColorMap } from './mesher'
