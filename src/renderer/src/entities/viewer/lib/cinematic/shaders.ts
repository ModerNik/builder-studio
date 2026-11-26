// Custom GLSL shaders for Render Studio: physical sky dome, studio backdrop, water sheen, and cinematic post-grade.
import * as THREE from 'three'

export interface SkyPalette {
  zenith: THREE.Color
  horizon: THREE.Color
  ground: THREE.Color
  sunColor: THREE.Color
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  fogColor: THREE.Color
  stars: number
  sunStrength: number
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
const mixColor = (a: number, b: number, t: number): THREE.Color =>
  new THREE.Color(a).lerp(new THREE.Color(b), clamp01(t))

/** Physically-inspired sky & light palette smoothly interpolated across sun elevation (-15°..85°). */
export function skyPalette(elevationDeg: number): SkyPalette {
  const day = smoothstep(5, 34, elevationDeg)
  const golden = smoothstep(-6, 10, elevationDeg) * (1 - smoothstep(14, 34, elevationDeg))
  const night = 1 - smoothstep(-10, 6, elevationDeg)

  const zenith = mixColor(0x0b132b, 0x2b6fe8, day)
    .lerp(new THREE.Color(0x1f2d5a), golden * 0.45)
    .lerp(new THREE.Color(0x060a18), night * 0.85)

  const horizon = mixColor(0x1a2647, 0x9ecbff, day)
    .lerp(new THREE.Color(0xff9b54), golden * 0.92)
    .lerp(new THREE.Color(0x101830), night * 0.85)

  const ground = mixColor(0x111520, 0x6f839c, day)
    .lerp(new THREE.Color(0x52393a), golden * 0.65)
    .lerp(new THREE.Color(0x080b14), night * 0.9)

  const sunColor = mixColor(0x9ec5ff, 0xfff8eb, day)
    .lerp(new THREE.Color(0xffa458), golden * 0.95)
    .lerp(new THREE.Color(0x88b4ff), night)

  const hemiSky = mixColor(0x2d4375, 0xd8ecff, day)
    .lerp(new THREE.Color(0xffc99e), golden * 0.55)
    .lerp(new THREE.Color(0x1c2b4f), night * 0.85)

  const hemiGround = mixColor(0x181c26, 0x8b8378, day)
    .lerp(new THREE.Color(0x5b443d), golden * 0.5)
    .lerp(new THREE.Color(0x0e111a), night * 0.85)

  const fogColor = horizon.clone().lerp(zenith, 0.12)
  const stars = smoothstep(4, -8, elevationDeg)
  const sunStrength = night > 0.5 ? 0.35 : 0.72 + day * 0.35

  return {
    zenith,
    horizon,
    ground,
    sunColor,
    hemiSky,
    hemiGround,
    fogColor,
    stars,
    sunStrength
  }
}

export interface SkyDome {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>
  update: (
    sunDir: THREE.Vector3,
    palette: SkyPalette,
    radius: number,
    center: THREE.Vector3
  ) => void
  dispose: () => void
}

/** Atmospheric sky dome with Rayleigh/Mie horizon glow, crisp sun disc, and procedural night starfield. */
export function createSkyDome(): SkyDome {
  const geo = new THREE.SphereGeometry(1, 32, 20)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.5).normalize() },
      uZenith: { value: new THREE.Color(0x2b6fe8) },
      uHorizon: { value: new THREE.Color(0x9ecbff) },
      uGround: { value: new THREE.Color(0x6f839c) },
      uSunColor: { value: new THREE.Color(0xfff8eb) },
      uStars: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      uniform vec3 uSunColor;
      uniform float uStars;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        float down = clamp(-d.y, 0.0, 1.0);

        vec3 sky = mix(uHorizon, uZenith, pow(up, 0.55));
        sky = mix(sky, uGround, pow(down, 0.45));

        float sunCos = max(dot(d, normalize(uSunDir)), 0.0);
        float mieHalo = pow(sunCos, 10.0) * 0.32 + pow(sunCos, 96.0) * 0.55;
        float sunDisc = smoothstep(0.9982, 0.9994, sunCos) * (1.0 - uStars * 0.65);
        sky += uSunColor * (mieHalo * (1.0 - uStars * 0.75) + sunDisc * 2.4);

        if (uStars > 0.01 && d.y > 0.02) {
          vec3 grid = floor(d * 190.0);
          float h = hash(grid);
          float star = step(0.9955, h) * smoothstep(0.02, 0.25, d.y);
          float twinkle = 0.65 + 0.35 * fract(h * 71.0);
          sky += vec3(0.85, 0.92, 1.0) * star * twinkle * uStars * 1.1;
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'cinematic-sky-dome'
  mesh.frustumCulled = false
  mesh.renderOrder = -100
  return {
    mesh,
    update: (sunDir, palette, radius, center) => {
      mesh.position.copy(center)
      const scale = Math.max(400, radius * 14)
      mesh.scale.setScalar(scale)
      mat.uniforms.uSunDir.value.copy(sunDir).normalize()
      mat.uniforms.uZenith.value.copy(palette.zenith)
      mat.uniforms.uHorizon.value.copy(palette.horizon)
      mat.uniforms.uGround.value.copy(palette.ground)
      mat.uniforms.uSunColor.value.copy(palette.sunColor)
      mat.uniforms.uStars.value = palette.stars
    },
    dispose: () => {
      geo.dispose()
      mat.dispose()
    }
  }
}

export interface StudioBackdrop {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>
  update: (baseHex: string, radius: number, center: THREE.Vector3) => void
  dispose: () => void
}

/** Smooth studio gradient dome for clean architectural/product renders. */
export function createStudioBackdrop(): StudioBackdrop {
  const geo = new THREE.SphereGeometry(1, 24, 16)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x2a2f3a) },
      uMid: { value: new THREE.Color(0x1c2028) },
      uBottom: { value: new THREE.Color(0x13161c) }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBottom;
      varying vec3 vDir;
      void main() {
        float y = clamp(vDir.y, -1.0, 1.0);
        vec3 col = y >= 0.0 ? mix(uMid, uTop, pow(y, 0.65)) : mix(uMid, uBottom, pow(-y, 0.65));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'cinematic-studio-backdrop'
  mesh.frustumCulled = false
  mesh.renderOrder = -99
  return {
    mesh,
    update: (baseHex, radius, center) => {
      mesh.position.copy(center)
      mesh.scale.setScalar(Math.max(400, radius * 14))
      const base = new THREE.Color(baseHex)
      const hsl = { h: 0, s: 0, l: 0 }
      base.getHSL(hsl)
      const top = new THREE.Color().setHSL(hsl.h, hsl.s * 0.9, Math.min(0.96, hsl.l + 0.1))
      const bottom = new THREE.Color().setHSL(
        hsl.h,
        Math.min(1, hsl.s * 1.1),
        Math.max(0.03, hsl.l - 0.08)
      )
      mat.uniforms.uMid.value.copy(base)
      mat.uniforms.uTop.value.copy(top)
      mat.uniforms.uBottom.value.copy(bottom)
    },
    dispose: () => {
      geo.dispose()
      mat.dispose()
    }
  }
}

/** Generate a tiny seamless procedural ripple normal map so water catches crisp sunlight glint. */
export function createWaterNormalTexture(): THREE.DataTexture {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  const height = (x: number, y: number): number => {
    const u = (x / size) * Math.PI * 2
    const v = (y / size) * Math.PI * 2
    return (
      Math.sin(u * 2 + v) * 0.35 +
      Math.cos(v * 3 - u * 2) * 0.28 +
      Math.sin((u + v) * 4) * 0.18 +
      Math.cos((u - v * 2) * 5) * 0.12
    )
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y)
      const dy = height(x, y + 1) - height(x, y - 1)
      const nx = -dx * 0.65
      const ny = -dy * 0.65
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      const i = (y * size + x) * 4
      data[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255)
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

/** Unified cinematic post-processing shader: Tilt-Shift / Focus DoF, ACES Filmic tone mapping, grade, vignette. */
export const CinematicGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uToneMapping: { value: 1 }, // 0 = linear, 1 = ACES Filmic
    uExposure: { value: 1.0 },
    uContrast: { value: 0.0 },
    uSaturation: { value: 0.0 },
    uTemperature: { value: 0.0 },
    uVignette: { value: 0.15 },
    uDofMode: { value: 0 }, // 0 = off, 1 = tilt-shift band, 2 = radial focus
    uFocusPoint: { value: new THREE.Vector2(0.5, 0.5) },
    uAperture: { value: 0.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform int uToneMapping;
    uniform float uExposure;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uTemperature;
    uniform float uVignette;
    uniform int uDofMode;
    uniform vec2 uFocusPoint;
    uniform float uAperture;
    varying vec2 vUv;

    vec3 acesFilm(vec3 x) {
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    vec4 sampleBlur(vec2 uv, float radiusPx) {
      if (radiusPx <= 0.25) return texture2D(tDiffuse, uv);
      vec2 texel = radiusPx / max(uResolution, vec2(1.0));
      vec4 acc = texture2D(tDiffuse, uv) * 0.20;
      acc += texture2D(tDiffuse, uv + vec2( 1.0,  0.0) * texel) * 0.10;
      acc += texture2D(tDiffuse, uv + vec2(-1.0,  0.0) * texel) * 0.10;
      acc += texture2D(tDiffuse, uv + vec2( 0.0,  1.0) * texel) * 0.10;
      acc += texture2D(tDiffuse, uv + vec2( 0.0, -1.0) * texel) * 0.10;
      acc += texture2D(tDiffuse, uv + vec2( 0.707,  0.707) * texel) * 0.075;
      acc += texture2D(tDiffuse, uv + vec2(-0.707,  0.707) * texel) * 0.075;
      acc += texture2D(tDiffuse, uv + vec2( 0.707, -0.707) * texel) * 0.075;
      acc += texture2D(tDiffuse, uv + vec2(-0.707, -0.707) * texel) * 0.075;
      acc += texture2D(tDiffuse, uv + vec2( 1.6,  0.6) * texel) * 0.025;
      acc += texture2D(tDiffuse, uv + vec2(-1.6, -0.6) * texel) * 0.025;
      acc += texture2D(tDiffuse, uv + vec2(-0.6,  1.6) * texel) * 0.025;
      acc += texture2D(tDiffuse, uv + vec2( 0.6, -1.6) * texel) * 0.025;
      return acc;
    }

    void main() {
      float blur = 0.0;
      if (uDofMode == 1 && uAperture > 0.001) {
        float dist = abs(vUv.y - uFocusPoint.y);
        blur = smoothstep(0.10, 0.45, dist) * uAperture * 8.5;
      } else if (uDofMode == 2 && uAperture > 0.001) {
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 delta = (vUv - uFocusPoint) * vec2(aspect, 1.0);
        blur = smoothstep(0.14, 0.62, length(delta)) * uAperture * 8.5;
      }

      vec4 tex = sampleBlur(vUv, blur);
      vec3 col = tex.rgb * uExposure;

      // Subtle warm/cool color temperature shift
      col.r *= 1.0 + uTemperature * 0.22;
      col.b *= 1.0 - uTemperature * 0.22;

      if (uToneMapping == 1) {
        col = acesFilm(col);
      } else {
        col = clamp(col, 0.0, 1.0);
      }

      // Contrast (keep pure black shadow pixels pure black even at negative contrast)
      float hasLight = step(0.0001, max(col.r, max(col.g, col.b)));
      col = mix(vec3(0.0), clamp((col - 0.5) * (1.0 + uContrast) + 0.5, 0.0, 1.0), hasLight);

      // Saturation
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = clamp(mix(vec3(luma), col, 1.0 + uSaturation), 0.0, 1.0);

      // Vignette
      if (uVignette > 0.001) {
        vec2 centered = vUv - 0.5;
        float vig = smoothstep(0.32, 0.88, length(centered));
        col *= 1.0 - vig * uVignette * 0.75;
      }

      gl_FragColor = vec4(col, tex.a);
    }
  `
}
