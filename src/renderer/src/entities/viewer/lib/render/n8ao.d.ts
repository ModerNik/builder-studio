// n8ao (ISC / CC0) ships no types: the part we use.
declare module 'n8ao' {
  import type { Camera, Scene } from 'three'
  import { Pass } from 'three/examples/jsm/postprocessing/Pass.js'
  export class N8AOPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number)
    camera: Camera
    configureAOPass(depthBufferType: unknown, ortho: boolean): void
    configureDenoisePass(depthBufferType: unknown, ortho: boolean): void
    configureEffectCompositer(depthBufferType: unknown, ortho: boolean): void
    configuration: {
      aoRadius: number
      distanceFalloff: number
      intensity: number
      gammaCorrection: boolean
      [k: string]: unknown
    }
  }
}
