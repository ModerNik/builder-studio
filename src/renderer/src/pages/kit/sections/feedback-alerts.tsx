import { useState, type ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Alert, InlineNotice } from '@/shared/ui/feedback/Alert'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { Cell, Grid, Narrow, Sub } from '../composites-demo'

export const meta = { group: 'Feedback', title: 'Alerts, notices and confirms' }

export default function FeedbackAlerts(): ReactElement {
  const [shown, setShown] = useState(true)
  const [confirm, setConfirm] = useState<'plain' | 'typed' | null>(null)
  const [done, setDone] = useState('')
  return (
    <div>
      <Sub
        title="Alert"
        note="Callout sits in the content; banner runs edge to edge at the top of a page or dock. Warnings and dangers are announced at once."
      >
        <div className="flex flex-col gap-3">
          <Alert tone="info" title="Dry run is on">
            Finalize copies into the cache instead of your schematics folder, and Git commit only
            shows git status.
          </Alert>
          <Alert
            tone="success"
            title="Round 3 saved"
            action={
              <Button size="sm" variant="outline">
                Copy feedback line
              </Button>
            }
          >
            builds/stone_watchtower/review/round_3.json
          </Alert>
          {shown ? (
            <Alert
              tone="warning"
              title="Another thread is working on stone_watchtower"
              onDismiss={() => setShown(false)}
            >
              Their edits can collide. Wait for it to finish or close one of the threads.
            </Alert>
          ) : (
            <Button
              size="xs"
              variant="outline"
              className="self-start"
              onClick={() => setShown(true)}
            >
              Show the dismissed warning
            </Button>
          )}
          <Alert
            tone="danger"
            title="Finalize needs a schematics folder"
            action={
              <Button size="sm" variant="outline">
                Open Settings → Minecraft
              </Button>
            }
          >
            Set Exported schematics folder before turning dry run off.
          </Alert>
          <Cell label="Banner" surface="none" className="overflow-hidden">
            <Alert
              variant="banner"
              tone="warning"
              title="Claude Code needs Git Bash on Windows"
              onDismiss={() => undefined}
            >
              It was not found automatically. Set its path in Settings → Advanced.
            </Alert>
          </Cell>
          <Cell label="Narrow: the action wraps under the text">
            <Narrow width={18.75}>
              <Alert
                tone="danger"
                title="Lint must be zero to export"
                action={
                  <Button size="sm" variant="outline">
                    Show checks
                  </Button>
                }
              >
                3 problems: 2 Blocks that will fall, 1 Incomplete doors or beds.
              </Alert>
            </Narrow>
          </Cell>
        </div>
      </Sub>
      <Sub title="InlineNotice" note="A one-line status beside a control or under a field.">
        <Cell label="All tones">
          <div className="flex flex-col gap-2">
            <InlineNotice tone="info">Empty fields use the build&apos;s defaults.</InlineNotice>
            <InlineNotice tone="success">
              Found claude at C:\Users\you\.local\bin\claude.exe
            </InlineNotice>
            <InlineNotice tone="warning">
              Names can&apos;t be reserved Windows names such as con or nul.
            </InlineNotice>
            <InlineNotice tone="danger">
              Use lowercase letters, digits and underscores, starting with a letter.
            </InlineNotice>
          </div>
        </Cell>
      </Sub>
      <Sub
        title="ConfirmDestructive"
        note="Names the action and the object, says what happens to which files, and repeats the verb on the button. Typed confirm for what cannot be undone."
      >
        <Grid min="16rem">
          <Cell label="Plain confirm">
            <Button size="sm" variant="destructive" onClick={() => setConfirm('plain')}>
              Delete selected version…
            </Button>
          </Cell>
          <Cell label="Typed-name confirm">
            <Button size="sm" variant="destructive" onClick={() => setConfirm('typed')}>
              Delete build…
            </Button>
          </Cell>
        </Grid>
        {done && (
          <p role="status" className="text-sm text-fg-secondary">
            {done}
          </p>
        )}
        <ConfirmDestructive
          open={confirm === 'plain'}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Delete v3.litematic?"
          action="Move to Recycle Bin"
          onConfirm={() => setDone('v3.litematic moved to the Recycle Bin (demo).')}
        >
          <p>
            The file and its renders in out/v3_3d/ go to the Recycle Bin. build.py and the design
            log stay as they are.
          </p>
        </ConfirmDestructive>
        <ConfirmDestructive
          open={confirm === 'typed'}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Delete stone_watchtower?"
          confirmText="stone_watchtower"
          onConfirm={() => setDone('stone_watchtower archived (demo).')}
        >
          <p>
            Its sources move to <span className="font-mono">builds/_archive/</span> and only{' '}
            <span className="font-mono">out/</span> goes to the Recycle Bin.
          </p>
        </ConfirmDestructive>
      </Sub>
    </div>
  )
}
