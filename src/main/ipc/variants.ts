import { z } from 'zod'
import { VariantStartSchema, PermitSchema } from '@shared/api'
import type { IpcContext } from '../index'
import type { Handle } from './guard'

/** Variant lanes. */
export function registerVariants(ctx: IpcContext, handle: Handle): void {
  const { variants } = ctx
  const none = z.undefined()
  handle('variants:start', VariantStartSchema, (v) => variants.start(v))
  const lane = z.enum(['A', 'B', 'C', 'D', 'E', 'F'])
  handle('variants:send', z.object({ lane, text: z.string().min(1) }), (a) =>
    variants.send(a.lane, a.text)
  )
  handle('variants:interrupt', lane, (l) => variants.interrupt(l))
  handle('variants:close', none, () => variants.closeAll())
  handle('variants:state', none, () => variants.state())
  handle('variants:pending', none, () => variants.pending())
  handle('variants:permit', z.object({ lane, permit: PermitSchema }), (a) =>
    variants.permit(a.lane, a.permit)
  )
}
