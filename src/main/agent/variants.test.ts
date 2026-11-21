import { expect, it, vi } from 'vitest'
import type { Provider } from '@shared/api'
import { VariantService } from './variants'
import type { Service } from './provider-agent'

const lane = (provider: Provider): Service =>
  ({
    state: { provider, build: 'tower', sessionId: null, status: 'idle', model: null, effort: null },
    close: vi.fn(),
    fork: vi.fn(async () => '019abcde-1234-7000-8000-000000000001'),
    send: vi.fn(async () => {})
  }) as unknown as Service

it('runs lanes on the selected provider, forks in each lane and keeps the cap', async () => {
  let provider: Provider = 'codex'
  const made: Service[] = []
  const make = vi.fn(() => {
    made.push(lane(provider))
    return made.at(-1)!
  })
  const service = new VariantService(
    make,
    () => provider,
    vi.fn(),
    () => 2
  )
  const request = {
    build: 'tower',
    lanes: [{ lane: 'A' as const, text: 'build A' }],
    from: '019abcde-1234-7000-8000-000000000009',
    model: null,
    effort: null
  }
  await expect(
    service.start({ ...request, lanes: [request.lanes[0], request.lanes[0]] })
  ).rejects.toThrow('own letter')
  await expect(
    service.start({
      ...request,
      lanes: ['A', 'B', 'C'].map((l) => ({ lane: l as 'A', text: 'hello' }))
    })
  ).rejects.toThrow('at most 2')
  await service.start(request)
  // the lane forks for itself, so the app-server holding the fork is the one that continues it
  expect(made[0].fork).toHaveBeenCalledWith(request.from, 'tower#A')
  expect(made[0].send).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'codex',
      build: 'tower',
      resume: { provider: 'codex', id: '019abcde-1234-7000-8000-000000000001' }
    })
  )
  // a provider switch replaces the lane instead of sending through the old one
  provider = 'claude'
  await service.start({ ...request, from: null })
  expect(make).toHaveBeenCalledTimes(2)
  expect(made[0].close).toHaveBeenCalled()
  expect(made[1].send).toHaveBeenCalledWith(expect.objectContaining({ provider: 'claude' }))
})
