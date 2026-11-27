import type {
  Availability,
  Feature,
  Requirement,
  RequirementDiagnostic,
  Settings
} from '@shared/api'
import { FEATURE_REQUIREMENTS, REQUIREMENT_REPAIR } from '@shared/availability'

const TTL = 60_000 // a failure: re-checked soon, so a repair outside the app shows up
// Checks spawn Python (heavy imports), Chromium or the provider CLI, and gated IPC calls wait for them:
// a pass lasts until its settings change, an explicit re-check, or an invalidation.
const PASS_TTL = 15 * 60_000
const AI_SETTINGS = [
  'provider',
  'claude',
  'codex',
  'gitBash',
  'git',
  'ollamaEndpoint',
  'ollamaModel'
] as const

/** Passes from earlier launches: per requirement, the key it passed under and its detail. */
export type Passes = Partial<Record<Requirement, { key: string; detail: string }>>

/** Checks are deduplicated and bounded; location changes cannot reuse an old result. */
export class AvailabilityService {
  private cache = new Map<
    string,
    { time: number; ttl: number; result: Promise<RequirementDiagnostic> }
  >()
  private generation = 0
  private saved: Passes | undefined
  // the saved passes this launch may still reuse, each once; none after an invalidation
  private restorable: Passes | null | undefined
  constructor(
    private d: {
      settings(): Settings
      probe(requirement: Requirement, settings: Settings): Promise<string | void>
      changed(): void
      /** Size/mtime of what a slow check tests; undefined: the check is never reused across launches. */
      fingerprint?(requirement: Requirement, settings: Settings): string | undefined
      store?: { read(): Passes; write(passes: Passes): void }
    }
  ) {}

  /** keepAi: the change cannot affect the AI provider check (its settings are part of its key). */
  invalidate(notify = true, keepAi = false): void {
    this.generation++
    this.restorable = null
    for (const requirement of this.cache.keys())
      if (!keepAi || !requirement.startsWith('ai:')) this.cache.delete(requirement)
    if (notify) this.d.changed()
  }
  /** Sign-in or API key changes: only the AI provider check can change. */
  invalidateAi(): void {
    this.generation++
    for (const requirement of this.cache.keys())
      if (requirement.startsWith('ai:')) this.cache.delete(requirement)
    this.d.changed()
  }
  // settings that only shape the UI or the agent's rules: changing them cannot change a check
  private signature(s: Settings): string {
    return JSON.stringify({
      ...s,
      agentAllow: undefined,
      setup: undefined,
      appearance: undefined,
      linter: undefined,
      variantCap: undefined,
      importSource: undefined,
      previousRuntime: undefined
    })
  }
  private passes(): Passes {
    if (this.saved === undefined) {
      try {
        this.saved = this.d.store?.read() ?? {}
      } catch {
        this.saved = {}
      }
      if (this.restorable === undefined) this.restorable = { ...this.saved }
    }
    return this.saved
  }
  private remember(requirement: Requirement, pass: { key: string; detail: string } | null): void {
    const passes = this.passes()
    if (pass) passes[requirement] = pass
    else if (!passes[requirement]) return
    else delete passes[requirement]
    try {
      this.d.store?.write(passes)
    } catch {
      // a lost cache only costs the next launch a re-check
    }
  }
  private check(requirement: Requirement, s: Settings): Promise<RequirementDiagnostic> {
    const signature =
      requirement === 'ai'
        ? JSON.stringify(AI_SETTINGS.map((name) => s[name]))
        : requirement === 'pack'
          ? JSON.stringify([s.minecraftVersion, s.runtime, s.python, s.resources, s.pack, s.jar])
          : this.signature({
              ...s,
              minecraftVersion: undefined,
              minecraftFiles: undefined,
              pack: '',
              jar: ''
            })
    const key = `${requirement}:${signature}`
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.time < cached.ttl) return cached.result
    const repair = REQUIREMENT_REPAIR[requirement]
    const fingerprint = this.d.store && this.d.fingerprint?.(requirement, s)
    const stamp = fingerprint === undefined ? undefined : `${key}|${fingerprint}`
    let restored: string | undefined
    if (stamp !== undefined) {
      const last = (this.passes(), this.restorable?.[requirement])
      if (last) delete this.restorable![requirement]
      if (last?.key === stamp) restored = last.detail
    }
    const entry = {
      time: Date.now(),
      ttl: restored === undefined ? TTL : PASS_TTL,
      result:
        restored !== undefined
          ? Promise.resolve({ ok: true, detail: restored, repair })
          : this.d.probe(requirement, s).then(
              (detail) => {
                entry.ttl = PASS_TTL
                const pass = { ok: true, detail: detail || 'Available', repair }
                if (stamp !== undefined)
                  this.remember(requirement, { key: stamp, detail: pass.detail })
                return pass
              },
              (e) => {
                if (stamp !== undefined) this.remember(requirement, null)
                return { ok: false, detail: String(e), repair }
              }
            )
    }
    this.cache.delete(key)
    this.cache.set(key, entry)
    if (this.cache.size > 32) this.cache.delete(this.cache.keys().next().value!)
    return entry.result
  }
  async require(...features: Feature[]): Promise<void> {
    return this.requireFor(undefined, ...features)
  }

  async requireFor(settings: Settings | undefined, ...features: Feature[]): Promise<void> {
    const current = this.d.settings()
    const s = settings ?? current
    const key = this.signature(current)
    const generation = this.generation
    for (const feature of features)
      for (const requirement of FEATURE_REQUIREMENTS[feature]) {
        const result = await this.check(requirement, s)
        if (!result.ok)
          throw new Error(
            `${feature} unavailable: ${result.detail}. Open Setup / Settings → ${result.repair}, repair and re-check.`
          )
      }
    if (key !== this.signature(this.d.settings()) || generation !== this.generation)
      throw new Error('Configuration changed during checks; retry the operation')
  }
  async get(refresh = false): Promise<Availability> {
    if (refresh) this.invalidate(false)
    const s = this.d.settings()
    const key = this.signature(s)
    const generation = this.generation
    const names = Object.keys(REQUIREMENT_REPAIR) as Requirement[]
    const entries = await Promise.all(
      names.map(async (name) => [name, await this.check(name, s)] as const)
    )
    if (key !== this.signature(this.d.settings()) || generation !== this.generation)
      throw new Error('Configuration changed; re-check availability')
    const requirements = Object.fromEntries(entries) as Availability['requirements']
    const features = Object.fromEntries(
      Object.entries(FEATURE_REQUIREMENTS).map(([name, needs]) => {
        const missing = needs.filter((need) => !requirements[need].ok)
        return [name, { ok: missing.length === 0, missing }]
      })
    ) as Availability['features']
    return { checkedAt: Date.now(), requirements, features }
  }
}
