import * as THREE from 'three'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'

/** Reuse OutlinePass's depth-tested mask for the fill, without duplicating selected geometry. */
export function selectionPass(scene: THREE.Scene, camera: THREE.Camera): OutlinePass {
  const pass = new OutlinePass(new THREE.Vector2(1, 1), scene, camera)
  pass.visibleEdgeColor.set(0xffffff)
  pass.hiddenEdgeColor.set(0)
  pass.edgeStrength = 1
  pass.edgeThickness = 1
  pass.downSampleRatio = 1
  // Packed RGBA depth needs exact bytes; half floats classify coincident selection faces as hidden.
  pass.renderTargetDepthBuffer.texture.type = THREE.UnsignedByteType
  pass.renderTargetDepthBuffer.texture.minFilter = THREE.NearestFilter
  pass.renderTargetDepthBuffer.texture.magFilter = THREE.NearestFilter
  const mask = pass.prepareMaskMaterial
  mask.clipping = true
  mask.vertexShader =
    '#include <clipping_planes_pars_vertex>\n' +
    mask.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n#include <clipping_planes_vertex>'
    )
  mask.fragmentShader =
    '#include <clipping_planes_pars_fragment>\n' +
    mask.fragmentShader
      .replace('void main() {', 'void main() {\n#include <clipping_planes_fragment>')
      .replace('-vPosition.z > viewZ', '-vPosition.z > viewZ + 0.002')
  pass.overlayMaterial.blending = THREE.NormalBlending
  pass.overlayMaterial.uniforms.selectionColor = { value: new THREE.Color() }
  pass.overlayMaterial.fragmentShader = `
    varying vec2 vUv;
    uniform sampler2D maskTexture;
    uniform sampler2D edgeTexture1;
    uniform vec3 selectionColor;
    void main() {
      vec4 mask = texture2D(maskTexture, vUv);
      float fill = (1.0 - mask.r) * (1.0 - mask.g) * 0.15;
      float edge = texture2D(edgeTexture1, vUv).r * mask.r;
      gl_FragColor = vec4(selectionColor, max(fill, edge));
    }`
  return pass
}
