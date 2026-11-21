// Renderer side of the IPC: the preload API and the TanStack Query client.
// The queries and stores built on them live in the entities (build, job, settings, availability).
import { QueryClient } from '@tanstack/react-query'

export const studio = window.studio
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } }
})
