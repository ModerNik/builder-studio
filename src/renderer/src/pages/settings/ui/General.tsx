// Settings › General: appearance, the workspace folder and Import builds, and the app (updates, setup).
import { useState, type ReactElement } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/shared/ui/primitives/button'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Progress } from '@/shared/ui/primitives/progress'
import { ThemeControl } from '@/entities/settings/ui/ThemeControl'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { SettingsPanel, SettingsRow, SettingsSection } from '@/entities/settings/ui/Settings'
import { useBuilds } from '@/entities/build/model/builds'
import { useJobs } from '@/entities/job/model/jobs'
import { releasesUrl, updateText, useUpdates } from '@/entities/update/model/updates'
import { type Settings } from '@shared/api'
import { UI_SCALES } from '@shared/constants'
import { ImportDialog } from '@/features/import-projects/ui/ImportProjects'
import { ErrorNotice } from './bits'
import { useSaveSettings } from '@/entities/settings/model/save'
import { checkForUpdates, installUpdate, showNotices, useGeneralActions } from '../model/general'
import { pickPath } from '../model/pick'

export function General({ settings }: { settings: Settings }): ReactElement {
  const save = useSaveSettings()
  const [importing, setImporting] = useState(false)
  const { open, rerun } = useGeneralActions()
  // the main process refuses a workspace change while work runs; say so before the click
  const builds = useBuilds().data ?? []
  const labelOf = (id: string): string => builds.find((b) => b.name === id)?.displayName || id
  const running = useJobs(useShallow((s) => s.jobs.filter((j) => j.state === 'running')))
  const scale = settings.appearance.scale
  const setScale = (to?: number): void =>
    void (to && save.mutate({ appearance: { ...settings.appearance, scale: to } }))
  return (
    <div className="flex flex-col gap-8">
      <SettingsSection id="h-appearance" title="Appearance">
        <SettingsPanel>
          <SettingsRow title="Theme" detail="System follows your Windows app mode.">
            <ThemeControl
              value={settings.appearance.theme}
              disabled={save.isPending}
              onChange={(theme) =>
                save.mutate({
                  appearance: {
                    ...settings.appearance,
                    theme
                  }
                })
              }
            />
          </SettingsRow>
          <SettingsRow
            title="Interface size"
            detail="Ctrl − and Ctrl + change it anywhere; Ctrl 0 resets it."
          >
            <div role="group" aria-label="Interface size" className="flex items-center gap-1">
              <IconButton
                label="Smaller"
                disabled={save.isPending || scale <= UI_SCALES[0]}
                onClick={() => setScale(UI_SCALES.findLast((s) => s < scale - 0.001))}
              >
                <Minus aria-hidden />
              </IconButton>
              <output aria-live="polite" className="w-14 text-center tabular-nums">
                {Math.round(scale * 100)}%
              </output>
              <IconButton
                label="Larger"
                disabled={save.isPending || scale >= UI_SCALES.at(-1)!}
                onClick={() => setScale(UI_SCALES.find((s) => s > scale + 0.001))}
              >
                <Plus aria-hidden />
              </IconButton>
              <Button
                variant="outline"
                disabled={save.isPending || scale === 1}
                onClick={() => setScale(1)}
              >
                Reset
              </Button>
            </div>
          </SettingsRow>
        </SettingsPanel>
        <ErrorNotice error={save.error} />
      </SettingsSection>
      <SettingsSection id="h-workspace" title="Workspace">
        <SettingsPanel>
          <SettingsRow
            title="Workspace folder"
            detail={settings.workspace || 'Not chosen yet'}
            mono={!!settings.workspace}
            below={
              <>
                {running.length > 0 && (
                  <InlineNotice tone="warning" className="text-sm">
                    {`${running.map((j) => labelOf(j.spec.build)).join(', ')} ${running.length > 1 ? 'have' : 'has'} a job running. Stop it to change the workspace.`}
                  </InlineNotice>
                )}
                <ErrorNotice error={open.error} />
              </>
            }
          >
            {settings.workspace && (
              <Button variant="ghost" onClick={() => open.mutate()}>
                Open folder
              </Button>
            )}
            <Button
              variant="outline"
              disabled={save.isPending || running.length > 0}
              onClick={() =>
                void pickPath('folder', settings.workspace).then(
                  (workspace) => workspace && save.mutate({ workspace })
                )
              }
            >
              {settings.workspace ? 'Change…' : 'Choose folder…'}
            </Button>
          </SettingsRow>
          <SettingsRow
            title="Import builds"
            detail="Copy builds from an older folder into this workspace. The original is not changed."
          >
            <Button variant="outline" onClick={() => setImporting(true)}>
              Import builds…
            </Button>
          </SettingsRow>
        </SettingsPanel>
      </SettingsSection>
      <SettingsSection id="h-app" title="App">
        <SettingsPanel>
          <Updates />
          <SettingsRow
            title="Licenses"
            detail="NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT."
          >
            <Button variant="outline" onClick={showNotices}>
              Licenses and notices
            </Button>
          </SettingsRow>
          <SettingsRow
            title="Setup guide"
            detail="Walk through first-run setup again. Your builds and settings are kept."
            below={<ErrorNotice error={rerun.error} />}
          >
            <Button variant="outline" disabled={rerun.isPending} onClick={() => rerun.mutate()}>
              Run setup again
            </Button>
          </SettingsRow>
        </SettingsPanel>
      </SettingsSection>
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </div>
  )
}

/** The updater as a settings row; the Crashed page shows it too, so a broken release can reach the fix. */
export function Updates(): ReactElement | null {
  const info = useUpdates()
  if (!info) return null
  const { state } = info
  return (
    <SettingsRow
      title="Updates"
      detail={`Version ${info.version} · ${updateText(state)}`}
      below={
        state.s === 'downloading' && (
          <Progress value={state.percent} aria-label={`Downloading ${state.version}`} />
        )
      }
    >
      {state.s === 'error' && (
        <Button asChild variant="ghost">
          <a href={releasesUrl} target="_blank" rel="noreferrer">
            Open GitHub Releases
          </a>
        </Button>
      )}
      {state.s === 'ready' ? (
        <Button variant="primary" onClick={installUpdate}>
          Restart to update
        </Button>
      ) : state.s !== 'off' ? (
        <Button
          variant="outline"
          disabled={state.s !== 'idle' && state.s !== 'error'}
          onClick={checkForUpdates}
        >
          Check now
        </Button>
      ) : null}
    </SettingsRow>
  )
}
