import '@/app/styles/main.css'
import '@/shared/lib/theme'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  CatchBoundary,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  RouterProvider
} from '@tanstack/react-router'
import { queryClient } from '@/shared/api/studio'
import { SetupGate } from '@/app/ui/SetupGate'
import { Shell } from '@/app/ui/Shell'
import { Gallery } from '@/pages/gallery/ui/Gallery'
import { PAGES, loadDocs } from '@/pages/docs/model/docs'
import { SECTIONS, type Section } from '@/entities/availability/model/setupIssues'
import { Crashed, CrashedWindow } from '@/app/ui/Crashed'

// a page's error shows inside the shell (defaultErrorComponent); the shell's own error replaces it
const root = createRootRoute({ component: Shell, errorComponent: CrashedWindow })
// only the shell and the gallery are in the first chunk; every other page's code loads when it is first opened
const routes = [
  createRoute({ getParentRoute: () => root, path: '/', component: Gallery }),
  createRoute({
    getParentRoute: () => root,
    path: '/settings',
    component: lazyRouteComponent(() => import('@/pages/settings/ui/Settings'), 'SettingsPage'),
    // /settings?section=ai: notices link straight to the fix
    validateSearch: (search): { section?: Section } => ({
      section: SECTIONS.find((s) => s === search.section)
    })
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/labs',
    component: lazyRouteComponent(() => import('@/pages/labs/ui/Labs'), 'Labs')
  }),
  // the UI kit is a development tool: production builds drop the route and the kit code with it
  ...(import.meta.env.DEV
    ? [
        createRoute({
          getParentRoute: () => root,
          path: '/kit',
          component: lazyRouteComponent(() => import('@/pages/kit/Kit'), 'Kit')
        })
      ]
    : []),
  createRoute({
    getParentRoute: () => root,
    path: '/docs',
    loader: loadDocs,
    component: lazyRouteComponent(() => import('@/pages/docs/ui/Docs'), 'Docs'),
    validateSearch: (search): { page?: string; at?: string } => ({
      page: PAGES.find((p) => p === search.page),
      at: typeof search.at === 'string' ? search.at : undefined
    })
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/build/$name',
    component: lazyRouteComponent(() => import('@/pages/workspace/ui/Workspace'), 'Workspace')
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/build/$name/review',
    component: lazyRouteComponent(() => import('@/pages/review/ui/Review'), 'Review')
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/build/$name/log',
    component: lazyRouteComponent(() => import('@/pages/design-log/ui/DesignLog'), 'DesignLog')
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/build/$name/ship',
    component: lazyRouteComponent(() => import('@/pages/ship/ui/Ship'), 'Ship')
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/build/$name/site',
    component: lazyRouteComponent(() => import('@/pages/site/ui/Site'), 'Site')
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/build/$name/refs',
    component: lazyRouteComponent(() => import('@/pages/refs/ui/Refs'), 'Refs')
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/build/$name/variants',
    component: lazyRouteComponent(() => import('@/pages/variants/ui/Variants'), 'Variants')
  })
]
// hash history: browser history breaks on reload under custom protocols
const router = createRouter({
  routeTree: root.addChildren(routes),
  history: createHashHistory(),
  defaultErrorComponent: Crashed
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* the router catches its own routes; this catches the setup gate around them */}
      <CatchBoundary getResetKey={() => 0} errorComponent={CrashedWindow}>
        <SetupGate>
          <RouterProvider router={router} />
        </SetupGate>
      </CatchBoundary>
    </QueryClientProvider>
  </StrictMode>
)
