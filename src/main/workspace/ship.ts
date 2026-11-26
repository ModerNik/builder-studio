// Ship: the last steps of a build that touch things outside out/. A ship job's `full` finalizes into a staging
// folder (MCB_SCHEMATICS), so nothing reaches the destination until verify passes and finalize copies it.
import { execFile } from 'child_process'
import { constants, copyFileSync, existsSync, mkdirSync } from 'fs'
import { access, readFile, stat } from 'fs/promises'
import { dirname, join, posix, relative } from 'path'
import { promisify } from 'util'
import type { ShipCommitResult } from '@shared/api'
import { buildDir } from './projects'
import { under } from './paths'
import { appendGist, writeAtomic } from './review'

/** A fresh staging folder for one ship job's finalize. */
export const stagingDir = (cache: string, build: string): string =>
  join(cache, 'ship', `${build.replace(/[^\w.-]/g, '_')}-${Date.now()}`)

/** Validates that the export destination exists and is a writable folder. */
export async function validateExportDir(dir: string): Promise<string> {
  if (!dir) throw new Error('Choose an export destination folder')
  const info = await stat(dir).catch(() => null)
  if (!info?.isDirectory()) throw new Error(`Export destination is not a folder: ${dir}`)
  await access(dir, constants.W_OK).catch(() => {
    throw new Error(`Export destination is not writable: ${dir}`)
  })
  return dir
}

/** Copies the staged final to the same sub path under `target`; refuses a file outside the staging folder. */
export function finalizeStaged(staged: string, staging: string, target: string): string {
  const sub = relative(staging, staged)
  const dest = under(target, sub)
  if (!under(staging, sub) || !dest || !existsSync(staged))
    throw new Error(`${staged} is not a staged final`)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(staged, dest)
  return dest
}

/** The results table, added at the end of the DESIGN.md log like a review gist (Status untouched). */
export async function appendResults(
  repo: string,
  build: string,
  title: string,
  rows: [string, string][]
): Promise<void> {
  const file = join(buildDir(repo, build), 'DESIGN.md')
  const md = await readFile(file, 'utf8').catch(() => `# ${build}\n`)
  const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  const table = [
    `### ${title}`,
    '',
    '| Check | Result |',
    '| --- | --- |',
    ...rows.map(([k, v]) => `| ${cell(k)} | ${cell(v)} |`)
  ]
  writeAtomic(file, appendGist(md, table.join('\n')))
}

const git = promisify(execFile)

/** Stages and commits builds/<name> only, nothing else in the repo; succeeds cleanly if nothing changed. */
export async function commitBuild(
  repo: string,
  build: string,
  message: string,
  executable = 'git'
): Promise<ShipCommitResult> {
  buildDir(repo, build) // validates the name
  const path = posix.join('builds', build)
  const run = async (...args: string[]): Promise<string> =>
    (await git(executable, args, { cwd: repo, windowsHide: true })).stdout
  const status = (await run('status', '--porcelain', '--', path)).trim()
  if (!status) return { committed: false, output: 'Nothing to commit (already up to date)' }
  await run('add', '-A', '--', path)
  const output = await run('commit', '-m', message, '--', path)
  return { committed: true, output }
}
