import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

/** Copies text to the clipboard; `copied` stays true for a moment after a copy. */
export function useCopy(ms = 1500): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = useCallback(
    (text: string) =>
      void navigator.clipboard.writeText(text).then(
        () => {
          setCopied(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setCopied(false), ms)
        },
        () => toast.error('Could not copy to the clipboard.')
      ),
    [ms]
  )
  return { copied, copy }
}
