import type { ReactElement } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/primitives/button'
import { Guidance } from '../specimen'

export const meta = { group: 'Overlays', title: 'Toast' }

const wait = (ms: number, fail = false): Promise<void> =>
  new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error('x')) : resolve()), ms))

export default function ToastSection(): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => toast('Saved build.py')}>
          Default
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.success('Exported watchtower_v14.litematic', { description: 'builds/watchtower/out/' })
          }
        >
          Success
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.error('Draft failed', { description: 'build.py line 42: name “roof_hieght” is not defined' })
          }
        >
          Error
        </Button>
        <Button variant="outline" onClick={() => toast.warning('3 floating blocks found')}>
          Warning
        </Button>
        <Button variant="outline" onClick={() => toast.info('A new engine version is available')}>
          Info
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const id = toast.loading('Running checks…')
            setTimeout(() => toast.success('Checks passed', { id }), 2000)
          }}
        >
          Loading
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.promise(wait(1500, Math.random() < 0.5), {
              loading: 'Exporting…',
              success: 'Exported',
              error: 'Export failed: disk is full'
            })
          }
        >
          Promise (50% fails)
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast('Version 13 deleted', {
              action: { label: 'Undo', onClick: () => toast.success('Version 13 restored') }
            })
          }
        >
          With action
        </Button>
        <Button
          variant="outline"
          onClick={() => toast('Pinned to the review', { closeButton: true, duration: Infinity })}
        >
          Persistent + close
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.custom((id) => (
              <div className="flex w-95 max-w-[calc(100vw-2rem)] items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-overlay px-3.5 py-2.5 text-fg shadow-md">
                <span className="text-sm font-medium">Custom notification card</span>
                <Button size="sm" variant="ghost" onClick={() => toast.dismiss(id)}>
                  Dismiss
                </Button>
              </div>
            ))
          }
        >
          Custom
        </Button>
      </div>
      <Guidance>
        Toasts confirm what just happened and offer one undo; they never carry the only copy of an error the
        user must fix (show that inline too). Type is an icon and words, not colour alone.

      </Guidance>
    </div>
  )
}
