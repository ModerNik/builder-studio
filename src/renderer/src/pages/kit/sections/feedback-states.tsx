import { useState, type ReactElement } from 'react'
import { Boxes, FolderSearch, Plus, SearchX, ServerCrash } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { Cell, Grid, Narrow, Sub } from '../composites-demo'

export const meta = { group: 'Feedback', title: 'Empty, error and loading states' }

const bridgeError = Object.assign(
  new Error(
    "Error invoking remote method 'jobs:start': Error: the engine bridge exited with code 1"
  ),
  {
    stack:
      "Error: the engine bridge exited with code 1\n    at PythonBridge.onExit (out/main/index.js:4120:17)\n    at ChildProcess.emit (node:events:518:28)\n  stderr: ModuleNotFoundError: No module named 'mcb'"
  }
)

export default function FeedbackStates(): ReactElement {
  const [reload, setReload] = useState(0)
  return (
    <div>
      <Sub
        title="EmptyState"
        note="Says what will be here and the next step. First run invites the first step; no results points at the filter; error says what failed. A page-size title is an h2 (it sits under the screen's h1), a panel-size one an h3."
      >
        <Grid min="20rem">
          <Cell label="First run (page)">
            <EmptyState
              size="page"
              icon={Boxes}
              title="No builds yet"
              action={
                <Button size="sm">
                  <Plus aria-hidden /> New build
                </Button>
              }
            >
              A build is a folder in builds/ with a build.py the engine runs. New build creates the
              starter scaffold and opens it.
            </EmptyState>
          </Cell>
          <Cell label="No results (panel)">
            <EmptyState
              variant="no-results"
              icon={SearchX}
              title="No parts match “chimney”"
              action={
                <Button size="sm" variant="outline">
                  Clear filter
                </Button>
              }
            >
              v3.litematic has 14 named parts. Check the spelling or clear the filter.
            </EmptyState>
          </Cell>
          <Cell label="Error (panel)">
            <EmptyState
              variant="error"
              icon={ServerCrash}
              title="The material list did not load"
              action={
                <Button size="sm" variant="outline">
                  Try again
                </Button>
              }
            >
              The build tools did not answer. Check Settings → Build tools.
            </EmptyState>
          </Cell>
          <Cell label="Narrow, long title">
            <Narrow width={16.25}>
              <EmptyState
                icon={FolderSearch}
                title="No references on the board for stone_watchtower_with_north_gatehouse"
              >
                Drop images here or paste them.
              </EmptyState>
            </Narrow>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="ErrorState and ErrorDetails"
        note="What failed and how to recover first; the raw error behind Technical details, selectable and copyable."
      >
        <Grid min="22rem">
          <Cell label="Inline, with retry">
            <ErrorState
              title="Draft generation failed"
              error={bridgeError}
              onRetry={() => undefined}
            >
              The engine bridge stopped before the first stage. Restart it from Settings → Build
              tools, then try again.
            </ErrorState>
          </Cell>
          <Cell label="Centred, replacing a view">
            <ErrorState
              layout="centered"
              title="Could not open builds/stone_watchtower"
              error="ENOENT: no such file or directory, scandir 'D:\\Minecraft\\workspace\\builds\\stone_watchtower\\out'"
              action={
                <Button size="sm" variant="ghost">
                  Back to Gallery
                </Button>
              }
            >
              The folder was moved or deleted outside the app.
            </ErrorState>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="LoadingState"
        note="Skeletons in the shape of what is coming, named for screen readers (aria-busy). After a long wait a line says it is still working."
      >
        <Grid min="16rem">
          <Cell label="List">
            <LoadingState label="Loading parts" />
          </Cell>
          <Cell label="Cards">
            <LoadingState label="Loading builds" layout="cards" rows={2} />
          </Cell>
          <Cell label="Detail">
            <LoadingState label="Loading the design log" layout="detail" rows={3} />
          </Cell>
          <Cell label="Transcript, long wait after 2 s">
            <LoadingState
              key={reload}
              label="Opening the session"
              layout="transcript"
              longAfter={2000}
              longMessage="Still opening the session. Long sessions take a while to load from disk."
            />
            <Button
              size="xs"
              variant="outline"
              className="mt-2"
              onClick={() => setReload((n) => n + 1)}
            >
              Restart
            </Button>
          </Cell>
        </Grid>
      </Sub>
    </div>
  )
}
