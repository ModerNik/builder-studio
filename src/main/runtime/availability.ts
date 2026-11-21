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

/** Checks are deduplicated and bounded; location changes cannot reuse an old result. */
export class AvailabilityService {
  private cache = new Map<
    string,
    { time: number; ttl: number; result: Promise<RequirementDiagnostic> }
  >()
  private generation = 0
  constructor(
    private d: {
      settings(): Settings
      probe(requirement: Requirement, settings: Settings): Promise<string | void>
      changed(): void
    }
  ) {}

  /** keepAi: the change cannot affect the AI provider check (its settings are part of its key). */
  invalidate(notify = true, keepAi = false): void {
    this.generation++
    for (const requirement of this.cache.keys())
      if (!keepAi || !requirement.startsWith('ai:')) this.cache.delete(requirement)
    if (notify) this.d.changed()
  }
  private signature(s: Settings): string {
    return JSON.stringify({ ...s, agentAllow: undefined, setup: undefined })
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
    const entry = {
      time: Date.now(),
      ttl: TTL,
      result: this.d.probe(requirement, s).then(
        (detail) => {
          entry.ttl = PASS_TTL
          return {
            ok: true,
            detail: detail || 'Available',
            repair: REQUIREMENT_REPAIR[requirement]
          }
        },
        (e) => ({ ok: false, detail: String(e), repair: REQUIREMENT_REPAIR[requirement] })
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
