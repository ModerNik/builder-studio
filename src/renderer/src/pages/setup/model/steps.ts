import type { Requirement, Settings } from '@shared/api'

type Step = Settings['setup']['step']

export const STEPS: Record<
  Step,
  {
    label: string
    optional: boolean
    keys: (keyof Settings)[] // the draft fields this step edits; Skip drops them
    needs: Requirement[] // what Ready checks to call the step ready
  }
> = {
  welcome: { label: 'Welcome', optional: false, keys: [], needs: [] },
  workspace: {
    label: 'Workspace',
    optional: false,
    keys: ['workspace', 'assets', 'runtimeHome', 'cache'],
    needs: ['workspace']
  },
  runtime: {
    label: 'Build tools',
    optional: false,
    keys: [],
    needs: ['engine', 'browser', 'git', 'identity']
  },
  minecraft: {
    label: 'Minecraft',
    optional: false,
    keys: ['jar', 'pack', 'schematics', 'saves', 'minecraftVersion', 'minecraftFiles'],
    needs: ['export']
  },
  ai: {
    label: 'AI assistant',
    optional: true,
    keys: ['provider', 'ollamaEndpoint', 'ollamaModel'],
    needs: ['ai']
  },
  verify: { label: 'Ready', optional: false, keys: [], needs: [] }
}

export const absolute = (path: string): boolean => /^(?:[A-Za-z]:[\\/]|\\\\)/.test(path.trim())
