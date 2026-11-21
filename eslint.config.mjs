import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

// The Sixteen Rule (docs/DESIGN.md): font sizes come from the type scale, never pixels
const pixelFontSizes = ['Literal[value', 'TemplateElement[value.raw'].map((node) => ({
  selector: `${node}=/\\btext-\\[[\\d.]+px\\]/]`,
  message: 'Use a type scale class (text-2xs…text-3xl) instead of a pixel font size.'
}))

// Screens use the ui primitives and tokens (docs/DESIGN.md, "Working with the kit")
const screenRules = [
  {
    selector: "JSXOpeningElement[name.name='select']",
    message: 'Use Select from @/shared/ui/primitives/select instead of a native <select>.'
  },
  {
    selector: "JSXOpeningElement[name.name=/^(button|Button)$/] > JSXAttribute[name.name='title']",
    message: 'Use IconButton (label) or Tooltip instead of title= on a button.'
  },
  {
    selector: 'JSXAttribute[name.name=/^(className|style)$/] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
    message: 'Use a colour token instead of a hex literal.'
  },
  {
    selector:
      'JSXAttribute[name.name=/^(className|style)$/] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
    message: 'Use a colour token instead of a hex literal.'
  }
]
// ui/ renders from props and model hooks (type imports and zustand/react/shallow selectors are fine)
const uiImports = [
  'error',
  {
    patterns: [
      {
        regex: '^(@/shared/api/|@tanstack/react-query$|zustand$|zustand/middleware)',
        allowTypeImports: true,
        message:
          "ui/ renders from props and model hooks: move IPC, queries and stores to the slice's model/."
      }
    ]
  }
]

// Feature-Sliced layers (docs/DESIGN.md, "Renderer layout"): a layer imports only from the layers below it.
// Imports between slices use the @/ alias, so the alias is all this has to watch.
const LAYERS = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']
const layerBoundaries = LAYERS.slice(0, -1).map((layer, i) => ({
  files: [`src/renderer/src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: LAYERS.slice(i + 1).map((above) => `@/${above}/**`),
            message: `${layer}/ may not import from a layer above it (shared < entities < features < widgets < pages < app).`
          }
        ]
      }
    ]
  }
}))

export default defineConfig(
  // .claude and .agents hold third-party agent skills (and local worktrees), not app code
  { ignores: ['**/node_modules', '**/dist', '**/out', '.claude/**', '.agents/**'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    // Kit sections export `meta` for the catalogue glob; ui primitives export their cva variants and field hook
    files: [
      'src/renderer/src/pages/kit/sections/*.tsx',
      'src/renderer/src/shared/ui/primitives/*.tsx'
    ],
    rules: {
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
          allowExportNames: [
            'meta',
            'badgeVariants',
            'buttonVariants',
            'linkVariants',
            'tabsListVariants',
            'toggleVariants',
            'useFieldControl'
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['warn', ...pixelFontSizes] }
  },
  {
    // Kit rules for everything above shared/ (the /kit catalogue excepted): use the ui primitives and tokens
    // instead (a later block replaces the rule's options, so the earlier selectors are repeated)
    files: ['src/renderer/src/{entities,features,widgets,pages,app}/**/*.tsx'],
    ignores: ['src/renderer/src/pages/kit/**'],
    rules: { 'no-restricted-syntax': ['warn', ...pixelFontSizes, ...screenRules] }
  },
  {
    // A slice's ui/ renders from props and its model/ hooks; IPC, queries and stores belong in model/
    files: ['src/renderer/src/{entities,features,widgets,pages,app}/**/ui/**/*.tsx'],
    ignores: ['src/renderer/src/pages/kit/**'],
    rules: {
      'no-restricted-syntax': ['warn', ...pixelFontSizes, ...screenRules],
      '@typescript-eslint/no-restricted-imports': uiImports
    }
  },
  ...layerBoundaries,
  eslintConfigPrettier
)
