import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { expect, it } from 'vitest'
import { SettingsSchema } from '@shared/api'
import { createBuild } from './workspace'
import { runtimeEnv } from '../app/locations'
import { listBuilds } from './projects'
import { command } from '../runtime/runtime'
import { ImportService } from './imports'

it.skipIf(!process.env.BS_ENGINE_PYTHON)(
  'creates and discovers a real scaffold in empty/existing workspaces and generates a draft',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'studio scaffold сборка '))
    try {
      const resources = resolve('out/runtime/engine/resources')
      const s = SettingsSchema.parse({
        workspace: join(root, 'workspace'),
        resources,
        python: process.env.BS_ENGINE_PYTHON,
        cache: join(root, 'cache'),
        pack: '',
        jar: '',
        schematics: '',
        claude: ''
      })
      mkdirSync(s.workspace)
      const env = runtimeEnv(s)
      expect(await createBuild(s, 'starter', env)).toBe('starter')
      const file = join(s.workspace, 'builds/starter/build.py')
      const before = readFileSync(file, 'utf8')
      expect(before).toContain('from mcb import cli')
      expect(before).toContain(s.python.replaceAll('\\', '/'))
      expect((await listBuilds(s.workspace)).map((b) => b.name)).toEqual(['starter'])
      await expect(createBuild(s, 'starter', env)).rejects.toThrow('already exists')
      expect(readFileSync(file, 'utf8')).toBe(before)
      await createBuild(s, 'second', env)
      expect((await listBuilds(s.workspace)).map((b) => b.name).sort()).toEqual([
        'second',
        'starter'
      ])
      writeFileSync(
        join(s.workspace, 'builds/second/dependency.py'),
        'from builds.starter.build import generate\n'
      )
      const imported = join(root, 'imported workspace')
      mkdirSync(imported)
      const importer = new ImportService(
        () => [],
        () => {}
      )
      const preview = await importer.preview({
        source: s.workspace,
        destination: imported,
        assets: true
      })
      await importer.run(preview.id)
      const importedEnv = runtimeEnv({ ...s, workspace: imported })
      await command(
        s.python,
        [
          '-c',
          'from builds.second.dependency import generate; assert generate(0, 0, 8, 8)[0].shape == (8, 24, 8)'
        ],
        { cwd: imported, env: importedEnv }
      )
      const output = await command(
        s.python,
        [join(imported, 'builds/starter/build.py'), 'proto', '--no-render'],
        {
          cwd: imported,
          env: importedEnv
        }
      )
      const events = output
        .split(/\r?\n/)
        .filter((line) => line.startsWith('@mcb '))
        .map((line) => JSON.parse(line.slice(5)))
      expect(events.at(-1)).toMatchObject({ v: 1, event: 'done' })
      expect(output).toContain('builds/starter/out/proto.litematic')
      const older = { ...s, minecraftVersion: '1.12.2' }
      await createBuild(older, 'legacy', runtimeEnv(older))
      const legacyDraft = await command(
        older.python,
        [join(older.workspace, 'builds/legacy/build.py'), 'proto', '--no-render'],
        { cwd: older.workspace, env: runtimeEnv(older) }
      )
      expect(legacyDraft).toContain('builds/legacy/out/proto.litematic')
      expect((await listBuilds(older.workspace)).find((b) => b.name === 'legacy')).toMatchObject({
        minecraftVersion: '1.12.2',
        versions: [expect.objectContaining({ minecraftVersion: '1.12.2' })]
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  },
  30000
)
