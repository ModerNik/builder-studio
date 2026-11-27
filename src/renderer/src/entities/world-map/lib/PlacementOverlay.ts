// Interactive 3D placement overlay for both Scout Terrain (area box + corner handles + margin)
// and Place Build (live 3D .litematic schematic + 90-degree rotation + 3D X/Y/Z TransformControls).
import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import {
  readSchematic,
  SchematicObject,
  type BlockColorMap,
  type Resources,
  type Schematic
} from '@/entities/viewer/lib/render'
import { Mesher } from '@/entities/viewer/lib/render/mesher'
import { cssColor } from '@/shared/lib/theme'
import {
  boxWithMargin,
  buildBoxFromOrigin,
  buildClipSlice,
  normalizeBox,
  rotatedFootprint
} from '../model/placement'
import type { Box2D, PlacementMode, RotationDeg, Vec3 } from '../model/types'
import type { WorldScene } from './WorldScene'

function tokenColor(name: string): THREE.Color {
  return new THREE.Color().setStyle(cssColor(name), THREE.LinearSRGBColorSpace)
}

function buildPerimeterLine(
  box: Box2D,
  y: number,
  color: THREE.Color,
  dashed: boolean
): THREE.Line {
  const [x1, z1, x2, z2] = normalizeBox(box)
  const pts = [
    new THREE.Vector3(x1, y, z1),
    new THREE.Vector3(x2 + 1, y, z1),
    new THREE.Vector3(x2 + 1, y, z2 + 1),
    new THREE.Vector3(x1, y, z2 + 1),
    new THREE.Vector3(x1, y, z1)
  ]
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const mat = dashed
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: 3,
        gapSize: 2,
        transparent: true,
        opacity: 0.85,
        depthTest: false
      })
    : new THREE.LineBasicMaterial({ color, depthTest: false })
  const line = new THREE.Line(geo, mat)
  if (dashed) line.computeLineDistances()
  line.renderOrder = 10
  return line
}

export class PlacementOverlay {
  readonly group = new THREE.Group()
  private boxGroup = new THREE.Group()
  private handlesGroup = new THREE.Group()
  private buildGroup = new THREE.Group()
  private anchor = new THREE.Object3D()
  private transform: TransformControls
  private transformHelper: THREE.Object3D

  private mode: PlacementMode = 'area'
  private areaBox: Box2D | null = null
  private origin: Vec3 = [0, 65, 0]
  private rotation: RotationDeg = 0
  private margin = 48
  private buildSize: Vec3 = [16, 16, 16]
  private clipY: number | null = null

  private loadedSrc: string | null = null
  private loadedSchematic: Schematic | null = null
  private buildObj: SchematicObject | null = null
  private resources: Resources | null = null
  private colors: BlockColorMap | null = null
  private remeshGen = 0
  private draggingHandle = false

  private onOriginDrag?: (origin: Vec3) => void
  private onBuildLoaded?: (size: Vec3 | null) => void

  constructor(
    private worldScene: WorldScene,
    callbacks: {
      onOriginDrag?: (origin: Vec3) => void
      onBuildLoaded?: (size: Vec3 | null) => void
    }
  ) {
    this.onOriginDrag = callbacks.onOriginDrag
    this.onBuildLoaded = callbacks.onBuildLoaded

    this.group.name = 'placement-overlay'
    this.group.add(this.boxGroup, this.handlesGroup, this.buildGroup, this.anchor)
    this.worldScene.overlayRoot.add(this.group)

    this.transform = new TransformControls(this.worldScene.activeCamera, this.worldScene.domElement)
    this.transform.setMode('translate')
    this.transform.setTranslationSnap(1)
    this.transform.setSize(0.85)
    this.applyAxisColors()
    this.transformHelper = this.transform.getHelper()
    this.transformHelper.renderOrder = 20
    this.worldScene.overlayRoot.add(this.transformHelper)

    this.transform.addEventListener('change', () => {
      this.worldScene.invalidate()
    })
    this.transform.addEventListener('dragging-changed', (e) => {
      this.draggingHandle = Boolean(e.value)
      this.worldScene.controls.enabled = !this.draggingHandle
      this.worldScene.invalidate()
    })
    this.transform.addEventListener('objectChange', () => {
      if (!this.draggingHandle || this.mode !== 'build') return
      const next: Vec3 = [
        Math.round(this.anchor.position.x),
        Math.round(this.anchor.position.y),
        Math.round(this.anchor.position.z)
      ]
      if (next[0] === this.origin[0] && next[1] === this.origin[1] && next[2] === this.origin[2]) {
        return
      }
      this.origin = next
      this.positionBuildGroup()
      this.applyClip()
      this.rebuildOutlines()
      this.onOriginDrag?.(next)
      this.worldScene.invalidate()
    })
  }

  get isDragging(): boolean {
    return this.draggingHandle
  }

  syncCamera(): void {
    this.transform.camera = this.worldScene.activeCamera
    this.updateTransformAttachment()
  }

  applyAxisColors(): void {
    this.transform.setColors(
      tokenColor('--axis-x'),
      tokenColor('--axis-y'),
      tokenColor('--axis-z'),
      tokenColor('--focus-ring')
    )
  }

  setResources(res: Resources | null, colors: BlockColorMap | null): void {
    this.resources = res
    if (colors) {
      const prefixed: BlockColorMap = {}
      for (const [k, v] of Object.entries(colors)) {
        prefixed[k] = v
        if (!k.includes(':')) prefixed[`minecraft:${k}`] = v
      }
      this.colors = prefixed
    } else {
      this.colors = null
    }
    if (this.loadedSchematic) {
      void this.remeshBuild(this.loadedSchematic)
    }
  }

  /** Load a build's .litematic schematic to render live on top of the 3D terrain. */
  async setBuildSrc(src: string | null): Promise<void> {
    if (src === this.loadedSrc) return
    this.loadedSrc = src
    this.remeshGen++
    this.disposeBuildMesh()
    this.loadedSchematic = null
    this.onBuildLoaded?.(null)
    if (!src) {
      this.rebuildOutlines()
      this.worldScene.invalidate()
      return
    }
    try {
      const res = await fetch(src)
      if (!res.ok || this.loadedSrc !== src) return
      const schem = await readSchematic(await res.arrayBuffer())
      if (this.loadedSrc !== src) return
      this.loadedSchematic = schem
      this.buildSize = [...schem.size]
      this.onBuildLoaded?.([...schem.size])
      await this.remeshBuild(schem)
      this.rebuildOutlines()
      this.worldScene.invalidate()
    } catch {
      // Ignore unreadable drafts; footprint box still works
    }
  }

  private async remeshBuild(schem: Schematic): Promise<void> {
    const gen = ++this.remeshGen
    this.disposeBuildMesh()
    const obj = new SchematicObject('placed-build', schem, this.resources)
    const mesher = new Mesher(schem, this.resources, this.colors)
    obj.mesher = mesher
    const ok = await mesher.build(
      obj.group,
      obj.materials,
      undefined,
      () => gen !== this.remeshGen || this.loadedSchematic !== schem
    )
    if (!ok || gen !== this.remeshGen || this.loadedSchematic !== schem) {
      obj.dispose()
      return
    }
    // Shift schematic local min to (0, 0, 0) so buildGroup sits cleanly on its corner
    obj.group.position.set(-schem.min[0] + 0.5, -schem.min[1] + 0.5, -schem.min[2] + 0.5)
    this.buildObj = obj
    this.buildGroup.add(obj.group)
    this.positionBuildGroup()
    this.applyClip()
    this.worldScene.invalidate()
  }

  private applyClip(): void {
    if (!this.buildObj) return
    const slice = buildClipSlice(this.origin[1], this.clipY, this.buildSize[1])
    if (!slice) {
      this.buildObj.setClipping([], null)
      return
    }
    this.buildObj.setClipping(
      [new THREE.Plane(new THREE.Vector3(0, -1, 0), slice.worldTopY)],
      slice.capLayer
    )
  }

  private disposeBuildMesh(): void {
    if (this.buildObj) {
      this.buildObj.dispose()
      this.buildObj = null
    }
  }

  update(params: {
    mode: PlacementMode
    box: Box2D | null
    origin: Vec3
    rotation: RotationDeg
    margin: number
    groundY: number | null
    clipY?: number | null
  }): void {
    this.mode = params.mode
    this.areaBox = params.box
    this.origin = params.origin
    this.rotation = params.rotation
    this.margin = params.margin
    this.clipY = params.clipY ?? null

    this.buildGroup.visible = this.mode === 'build'
    this.positionBuildGroup()
    this.applyClip()
    this.anchor.position.set(this.origin[0], this.origin[1], this.origin[2])
    this.updateTransformAttachment()
    this.rebuildOutlines(params.groundY)
    this.worldScene.invalidate()
  }

  private updateTransformAttachment(): void {
    const showHandles = this.mode === 'build' && this.worldScene.cameraMode !== 'top'
    if (showHandles) {
      this.transform.attach(this.anchor)
      this.transformHelper.visible = true
    } else {
      this.transform.detach()
      this.transformHelper.visible = false
    }
  }

  /** Rotate build around Y while keeping its world min corner anchored at `origin`. */
  private positionBuildGroup(): void {
    const [sx, , sz] = this.buildSize
    const rad = (-this.rotation * Math.PI) / 180
    this.buildGroup.rotation.set(0, rad, 0)
    // Offset so the rotated bounding box's min X/Z corner stays exactly at origin[0], origin[2]
    let ox = this.origin[0]
    let oz = this.origin[2]
    if (this.rotation === 90) {
      ox += sz
    } else if (this.rotation === 180) {
      ox += sx
      oz += sz
    } else if (this.rotation === 270) {
      oz += sx
    }
    this.buildGroup.position.set(ox, this.origin[1], oz)
  }

  private clearGroup(g: THREE.Group): void {
    while (g.children.length) {
      const c = g.children[0]
      c.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose()
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
          else o.material.dispose()
        }
      })
      g.remove(c)
    }
  }

  /** Hit-test corner handles in Area mode; returns corner index (0..3) or -1. */
  pickCornerHandle(clientX: number, clientY: number): number {
    if (this.mode !== 'area' || !this.handlesGroup.children.length) return -1
    const rect = this.worldScene.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    const rc = new THREE.Raycaster()
    rc.setFromCamera(ndc, this.worldScene.activeCamera)
    const hits = rc.intersectObjects(this.handlesGroup.children, false)
    if (!hits.length) return -1
    const idx = hits[0].object.userData.cornerIndex
    return typeof idx === 'number' ? idx : -1
  }

  private rebuildOutlines(groundY?: number | null): void {
    this.clearGroup(this.boxGroup)
    this.clearGroup(this.handlesGroup)

    const accent = tokenColor('--accent-solid')
    const box =
      this.mode === 'build'
        ? buildBoxFromOrigin(this.origin, this.buildSize, this.rotation)
        : this.areaBox
    if (!box) return

    const [x1, z1, x2, z2] = normalizeBox(box)
    const w = x2 - x1 + 1
    const d = z2 - z1 + 1
    const cx = x1 + w / 2
    const cz = z1 + d / 2
    const baseY =
      this.mode === 'build'
        ? this.origin[1]
        : (groundY ?? this.worldScene.streamer.heightAt(Math.round(cx), Math.round(cz)) ?? 64) +
          1.15

    // Translucent terrain footprint slab
    const fillGeo = new THREE.PlaneGeometry(w, d)
    fillGeo.rotateX(-Math.PI / 2)
    const fillMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: this.mode === 'area' ? 0.22 : 0.14,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    const fill = new THREE.Mesh(fillGeo, fillMat)
    fill.position.set(cx, baseY, cz)
    fill.renderOrder = 8
    this.boxGroup.add(fill)

    // Crisp solid perimeter
    this.boxGroup.add(buildPerimeterLine([x1, z1, x2, z2], baseY + 0.15, accent, false))

    // In Area mode, add a subtle vertical prism frame + 4 draggable corner markers
    if (this.mode === 'area') {
      const h = Math.min(24, Math.max(8, Math.round(Math.min(w, d) * 0.25)))
      const prismGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d))
      const prismMat = new THREE.LineBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.45
      })
      const prism = new THREE.LineSegments(prismGeo, prismMat)
      prism.position.set(cx, baseY + h / 2, cz)
      this.boxGroup.add(prism)

      const corners: [number, number][] = [
        [x1, z1],
        [x2 + 1, z1],
        [x2 + 1, z2 + 1],
        [x1, z2 + 1]
      ]
      const handleRadius = Math.max(1.1, Math.min(2.6, Math.min(w, d) * 0.045))
      corners.forEach(([hx, hz], idx) => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(handleRadius, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })
        )
        mesh.position.set(hx, baseY + 0.6, hz)
        mesh.userData.cornerIndex = idx
        mesh.renderOrder = 15
        this.handlesGroup.add(mesh)
      })
    } else if (!this.buildObj) {
      // Fallback wireframe box while .litematic is loading
      const [fw, fd] = rotatedFootprint(this.buildSize, this.rotation)
      const h = this.buildSize[1]
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(fw, h, fd)),
        new THREE.LineBasicMaterial({ color: accent })
      )
      wire.position.set(this.origin[0] + fw / 2, this.origin[1] + h / 2, this.origin[2] + fd / 2)
      this.boxGroup.add(wire)
    }

    // Dashed outer margin perimeter
    if (this.margin > 0) {
      this.boxGroup.add(
        buildPerimeterLine(boxWithMargin([x1, z1, x2, z2], this.margin), baseY + 0.1, accent, true)
      )
    }
  }

  dispose(): void {
    this.remeshGen++
    this.loadedSrc = null
    this.loadedSchematic = null
    this.transform.detach()
    this.transform.dispose()
    this.transformHelper.removeFromParent()
    this.disposeBuildMesh()
    this.clearGroup(this.boxGroup)
    this.clearGroup(this.handlesGroup)
    this.group.removeFromParent()
  }
}
