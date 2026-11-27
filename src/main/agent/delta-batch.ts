// Streamed text arrives one token per event and the renderer updates the transcript per message, so
// consecutive text deltas of one item are merged and sent at most every `ms`. Any other message of the
// same thread (or variant lane) flushes first, so the renderer sees the same order.
type Send = (channel: string, payload: unknown) => void
interface Text {
  type: string
  id?: string
  text?: string
  delta?: boolean
  plan?: boolean
}
interface Payload {
  thread?: string | null
  lane?: string
  data?: Text
}

export function batchDeltas(send: Send, ms = 50): Send {
  const pending = new Map<string, { channel: string; payload: Payload; timer: NodeJS.Timeout }>()
  const flush = (key: string): void => {
    const p = pending.get(key)
    if (!p) return
    pending.delete(key)
    clearTimeout(p.timer)
    send(p.channel, p.payload)
  }
  return (channel, payload) => {
    const scope = channel.split(':')[0]
    if (scope !== 'agent' && scope !== 'variant') return send(channel, payload)
    const p = payload as Payload
    const key = `${scope}:${p.thread ?? p.lane ?? ''}`
    const d = p.data
    if (channel.endsWith(':msg') && d?.type === 'text' && d.delta) {
      const prev = pending.get(key)
      const last = prev?.payload.data
      if (prev && prev.channel === channel && last?.id === d.id && !!last?.plan === !!d.plan) {
        prev.payload = {
          ...prev.payload,
          data: { ...last!, text: (last!.text ?? '') + (d.text ?? '') }
        }
        return
      }
      flush(key)
      pending.set(key, { channel, payload: p, timer: setTimeout(() => flush(key), ms) })
      return
    }
    flush(key)
    send(channel, payload)
  }
}
