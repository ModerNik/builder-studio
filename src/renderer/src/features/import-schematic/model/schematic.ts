import { useEffect, useRef, useState } from 'react'
import type {
  BlockCoordinates,
  SchematicCommit,
  SchematicInspection,
  SchematicSession
} from '@shared/api'
import { studio } from '@/shared/api/studio'
import { errorText } from '@/entities/build/model/workspace'

export interface SchematicFile {
  source: SchematicSession | null
  choosing: boolean
  choose: () => Promise<SchematicSession | null>
  clear: () => void
  failure: string
}

export function useSchematicFile(build?: string, minecraftVersion?: string): SchematicFile {
  const [source, setSource] = useState<SchematicSession | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [failure, setFailure] = useState('')
  useEffect(() => {
    if (!source) return
    return () => void studio.schematic.cancel(source.id).catch(() => {})
  }, [source])

  const choose = async (): Promise<SchematicSession | null> => {
    setChoosing(true)
    setFailure('')
    try {
      const next = await studio.schematic.choose(build, minecraftVersion)
      if (next) setSource(next)
      return next
    } catch (error) {
      setFailure(errorText(error))
      return null
    } finally {
      setChoosing(false)
    }
  }
  const clear = (): void => {
    setSource(null)
    setFailure('')
  }
  return { source, choosing, choose, clear, failure }
}

// The dialogs always show the warnings above the commit button; the original file is kept with the part.
export const commitSchematic = (
  input: Omit<SchematicCommit, 'acceptWarnings'>
): Promise<{ build: string; part?: string }> =>
  studio.schematic.commit({ ...input, acceptWarnings: true })

export function useSchematicInspection(
  id: string,
  [x, y, z]: BlockCoordinates,
  key: string
): {
  preview?: { key: string; result: SchematicInspection }
  issue?: { key: string; message: string }
} {
  const [preview, setPreview] = useState<{ key: string; result: SchematicInspection }>()
  const [issue, setIssue] = useState<{ key: string; message: string }>()
  const inspections = useRef(Promise.resolve())

  useEffect(() => {
    let stale = false
    const timer = window.setTimeout(() => {
      inspections.current = inspections.current.then(async () => {
        if (stale) return
        try {
          const result = await studio.schematic.inspect(id, [x, y, z])
          if (!stale) setPreview({ key, result })
        } catch (error) {
          if (!stale) setIssue({ key, message: errorText(error) })
        }
      })
    }, 180)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [id, x, y, z, key])

  return { preview, issue }
}
