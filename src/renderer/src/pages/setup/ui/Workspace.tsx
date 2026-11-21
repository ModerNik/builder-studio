import { useState, type ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/shared/ui/primitives/collapsible'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { SettingsPanel, SettingsRow } from '@/entities/settings/ui/Settings'
import { useAvailability } from '@/entities/availability/model/availability'
import { ImportDialog } from '@/features/import-projects/ui/ImportProjects'
import { StepHeader, type StepProps } from './parts'
import { absolute } from '../model/steps'
import { pickFolder } from '../model/setup'

export function Workspace({
  form,
  patch,
  act,
  saved,
  suggestion
}: StepProps & { saved: string; suggestion: string }): ReactElement {
  const [importing, setImporting] = useState(false)
  const availability = useAvailability().data
  const value = form.workspace.trim()
  const verified = !!value && value === saved && availability?.requirements.workspace.ok
  return (
    <div className="flex flex-col gap-6">
      <StepHeader eyebrow="Step 2 of 6" title="A home for your builds">
        The default folders are ready to use. Continue to create them, or choose your own locations.
      </StepHeader>
      <Field
        id="setup-workspace"
        label="Workspace folder"
        error={
          value && !absolute(value)
            ? 'Enter the full folder path, starting with a drive letter such as C:\\.'
            : undefined
        }
      >
        <span className="flex min-w-0 gap-2">
          <Input
            value={form.workspace}
            spellCheck={false}
            className="min-w-0 flex-1 font-mono text-sm"
            onChange={(e) => patch({ workspace: e.target.value })}
          />
          <Button
            variant="outline"
            onClick={() =>
              act(async () => {
                const path = await pickFolder(form.workspace || suggestion)
                if (path) patch({ workspace: path })
              })
            }
          >
            Browse…
          </Button>
        </span>
      </Field>
      <div role="status" className="-mt-4 flex min-h-6 flex-wrap items-center gap-x-3 text-sm">
        {!value ? (
          <>
            <span className="text-fg-secondary">Choose a folder to continue.</span>
            {suggestion && (
              <Button
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => patch({ workspace: suggestion })}
              >
                Use {suggestion.split(/[\\/]/).slice(-2).join('\\')}
              </Button>
            )}
          </>
        ) : !absolute(value) ? null : verified ? (
          <InlineNotice tone="success" className="text-sm">
            This folder can be used.
          </InlineNotice>
        ) : (
          <span className="text-fg-secondary">
            It will be created if it doesn’t exist. Builder Studio checks it can write there when
            you continue.
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        className="self-start"
        onClick={() =>
          patch({
            workspace: suggestion,
            assets: '',
            runtimeHome: '',
            cache: ''
          })
        }
      >
        Use default folders
      </Button>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline">Customize other folders</Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 pt-4">
          {(
            [
              ['assets', 'Assets', 'An assets folder inside your workspace'],
              ['runtimeHome', 'Build tools', 'A runtime folder in your user data'],
              ['cache', 'Cache', 'A cache folder in your user data']
            ] as const
          ).map(([key, label, hint]) => (
            <Field key={key} label={label} hint={hint}>
              <span className="flex min-w-0 gap-2">
                <Input
                  value={form[key]}
                  placeholder="Use default"
                  spellCheck={false}
                  className="min-w-0 flex-1 font-mono text-sm"
                  onChange={(e) => patch({ [key]: e.target.value })}
                />
                <Button
                  variant="outline"
                  aria-label={`Choose ${label.toLowerCase()} folder`}
                  onClick={() =>
                    act(async () => {
                      const path = await pickFolder(form[key])
                      if (path) patch({ [key]: path })
                    })
                  }
                >
                  Browse…
                </Button>
              </span>
            </Field>
          ))}
        </CollapsibleContent>
      </Collapsible>
      <SettingsPanel>
        <SettingsRow
          title="Already have builds somewhere else?"
          detail="Copy them into this workspace. The originals are not changed."
        >
          <Button variant="outline" onClick={() => setImporting(true)}>
            Import builds…
          </Button>
        </SettingsRow>
      </SettingsPanel>
      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        destination={absolute(value) ? value : undefined}
      />
    </div>
  )
}
