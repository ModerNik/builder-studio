# Contributing to Builder Studio

Thank you for your interest in contributing to Builder Studio! This guide explains how to set up your environment, follow our architecture and UI rules, and submit pull requests.

## Prerequisites

- **Node.js 24+** and **npm**
- **Windows 10/11 x64** (target platform for the Electron desktop app)
- **Git**

You can run the dev server, inspect the UI kit (`/kit`), work on the 3D viewer and hand editor, edit documentation, and run the full unit test suite without access to the proprietary BS Engine source.

## Getting started

```bash
git clone https://github.com/ModerNik/builder-studio.git
cd builder-studio
npm install
npm run dev
```

To run the app against a clean profile without touching your own settings:

```powershell
$env:BS_USER_DATA = 'out/test-profile'; npx electron-vite dev -- --remote-debugging-port=9223
```

Delete `out/test-profile` when you are done. Keep temporary build outputs and test profiles under `out/` (which is gitignored).

## Architecture and UI rules

### Feature-Sliced Design (`src/renderer/src/`)

The renderer follows Feature-Sliced Design with six strict layers:

```text
shared < entities < features < widgets < pages < app
```

- A layer may only import from layers below it (enforced by ESLint).
- Inside each slice, `ui/` holds presentational components and `model/` holds stores, hooks, queries, and pure logic with colocated `*.test.ts` files.
- `ui/` components must not directly import `@/shared/api/*`, `@tanstack/react-query`, or `zustand` store factories.

### Design system and UI kit

All UI work follows [docs/DESIGN.md](docs/DESIGN.md) and the custom **Deepslate & Copper** OKLCH token system in `src/renderer/src/app/styles/main.css`.

When adding or changing a component, variant, state, or token:

1. **Design it first** in [docs/DESIGN.md](docs/DESIGN.md) (tokens only, dark and light themes, density rules, keyboard accessibility, reduced motion).
2. **Add or update it in the kit** under `src/renderer/src/shared/ui/` (or the owning slice's `ui/`) and add a showcase section in `src/renderer/src/pages/kit/sections/`. View all components live in development at **Settings → Advanced → UI kit** (`/kit`).
3. **Use it in screens** — never write hex/OKLCH literals, pixel font sizes (`text-[13px]`), native `<select>`, or `title=` tooltips on buttons.

## Before you open a pull request

Run all local verification checks (GitHub Actions runs the same lint, typecheck and tests on pull requests, and the release pipeline on `v*` tags):

```bash
npm run typecheck
npm run lint
npm test
```

If you changed colour tokens, `src/renderer/src/app/styles/tokens.test.ts` automatically verifies WCAG 2.2 contrast ratios across both themes. If you changed user documentation in `src/renderer/src/pages/docs/content/`, `src/renderer/src/pages/docs/model/docs.test.ts` verifies all page links and heading anchors.

## Branches and commit messages

- Create a topic branch from `main` using lowercase kebab-case: `<type>/<short-description>` (for example `fix/viewer-selection` or `feat/ruler-copy`).
- Follow conventional commits: `type: message` or `type(scope): message` (for example `fix(editor): preserve stair shape when painting`). Never use `repo` as a scope.
- Pull requests are squash-merged into `main` to keep release history clean.

## Licensing of contributions

By submitting a contribution to Builder Studio, you agree that your contribution is licensed under **AGPL-3.0-only**, together with the integration permission in [legal/ADDITIONAL_PERMISSIONS.md](legal/ADDITIONAL_PERMISSIONS.md) and the additional terms in [legal/ADDITIONAL_TERMS.md](legal/ADDITIONAL_TERMS.md). See [LICENSE](LICENSE) and [legal/licensing.md](legal/licensing.md) for details.
