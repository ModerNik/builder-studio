import { useRouterState } from '@tanstack/react-router'

/** The build open in the workspace, from the route. */
export function useCurrentBuild(): string | null {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const m = /^\/build\/(.+?)(?:\/(?:review|log|ship|site|refs|variants))?$/.exec(path)
  return m ? decodeURIComponent(m[1]) : null
}
