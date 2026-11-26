// The Brief dialog: writes DESIGN.md §1 and starts a new thread with it. The hook returns the dialog and its opener,
// so the Agent panel's header, its phone More menu and the empty thread can all open it.
import type { ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import { Field } from '@/shared/ui/primitives/field'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { useBuild } from '@/entities/build/model/builds'
import { today, useBrief } from '@/features/agent-chat/model/useBrief'
import { RefsPicker } from './AgentComposer'

export function useBriefDialog(build: string): {
  dialog: ReactElement
  openBrief: () => Promise<void>
} {
  const { brief, setBriefOpen, refs, setRefs, openBrief, saveBrief } = useBrief(build)
  const displayName = useBuild(build).data?.displayName || build

  const dialog = (
    <Dialog open={!!brief} onOpenChange={(o) => !o && setBriefOpen(null)}>
      <DialogContent size="lg" phone="sheet">
        <DialogHeader>
          <DialogTitle>Brief for {displayName}</DialogTitle>
          <DialogDescription>
            Saved as DESIGN.md §1 ({today()}), then sent as the first message of a new thread.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Field label="Brief">
            <Textarea
              autoFocus
              value={brief?.text ?? ''}
              onChange={(e) => brief && setBriefOpen({ ...brief, text: e.target.value })}
              rows={12}
              placeholder="What to build, for whom, size, style, references, must-haves…"
            />
          </Field>
          <div>
            <RefsPicker build={build} picked={refs} onChange={setRefs} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setBriefOpen(null)}>
            Cancel
          </Button>
          <Button disabled={!brief?.text.trim()} onClick={() => void saveBrief()}>
            Save and start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
  return { dialog, openBrief }
}
