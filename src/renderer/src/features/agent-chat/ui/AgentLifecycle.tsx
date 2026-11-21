// The round lifecycle from docs/agent-workflow.md as the Agent panel's second row: Brief writes DESIGN.md §1 and
// starts a session with it; Approve round has the agent update Status, then commits builds/<build> (after a
// confirm) and starts the next round's session. The app itself never touches the Status block. The hook returns
// the row and its actions, so the phone header's More menu can offer Brief and Approve round too.
import type { ReactElement } from 'react'
import { CircleCheck, FileText } from 'lucide-react'
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
import { Input } from '@/shared/ui/primitives/input'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { CodeBlock } from '@/shared/ui/code/CodeBlock'
import { Tip } from '@/shared/ui/common/Tip'
import { busy, useThread } from '@/features/agent-chat/model/agent'
import { today, useRound } from '@/features/agent-chat/model/lifecycle'
import { PROVIDER_TEXT } from '@/features/agent-chat/model/providers'
import { RefsPicker } from './AgentComposer'

export interface Lifecycle {
  /** The row (hidden on phones, where More has its actions); it also holds the Brief and commit dialogs. */
  row: ReactElement
  openBrief: () => Promise<void>
  approve: () => Promise<void>
  /** A turn runs: neither action is offered. */
  running: boolean
  /** Approve is under way (waiting for Status, or the commit dialog is open). */
  approving: boolean
  /** The last round in DESIGN.md, once read. */
  round: number | null
}

export function useLifecycle(build: string): Lifecycle {
  const running = useThread((t) => busy(t.state))
  const provider = useThread((t) => t.state.provider)
  const {
    n,
    brief,
    setBriefOpen,
    refs,
    setRefs,
    phase,
    commit,
    setCommit,
    openBrief,
    saveBrief,
    approve,
    cancelCommit,
    doCommit
  } = useRound(build)

  const row = (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border-subtle px-3 py-2 max-sm:hidden">
      <Button size="sm" variant="outline" disabled={running} onClick={() => void openBrief()}>
        <FileText aria-hidden /> Brief
      </Button>
      <Tip label="The agent updates Status, then you confirm a commit of this build's folder">
        <Button
          size="sm"
          variant="outline"
          disabled={running || phase !== 'idle'}
          onClick={() => void approve()}
        >
          <CircleCheck aria-hidden /> Approve round{n ? ` ${n}` : ''}
        </Button>
      </Tip>
      {phase === 'status' && (
        <span role="status" className="text-sm text-fg-secondary">
          Waiting for the Status update…
        </span>
      )}
      <span className="flex-1" />
      <span className="truncate text-sm text-fg-secondary">{PROVIDER_TEXT[provider].name}</span>

      <Dialog open={!!brief} onOpenChange={(o) => !o && setBriefOpen(null)}>
        <DialogContent size="lg" phone="sheet">
          <DialogHeader>
            <DialogTitle>Brief for {build}</DialogTitle>
            <DialogDescription>
              Saved as DESIGN.md §1 ({today()}), then sent as the first message of a new session.
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

      <Dialog open={!!commit} onOpenChange={(o) => !o && cancelCommit()}>
        <DialogContent size="lg" phone="sheet">
          <DialogHeader>
            <DialogTitle>Commit builds/{build}</DialogTitle>
            <DialogDescription>
              Only this build&apos;s folder is committed. Nothing is pushed.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <CodeBlock code={commit?.diff ?? ''} title="Changes" maxHeight="16rem" />
            <Field label="Commit message">
              <Input
                value={commit?.message ?? ''}
                onChange={(e) => commit && setCommit({ ...commit, message: e.target.value })}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelCommit}>
              Cancel
            </Button>
            <Button
              disabled={!commit?.message.trim() || commit.diff === 'nothing to commit'}
              onClick={() => void doCommit()}
            >
              Commit and start round {(commit?.n ?? 0) + 1}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
  return { row, openBrief, approve, running, approving: phase !== 'idle', round: n }
}
