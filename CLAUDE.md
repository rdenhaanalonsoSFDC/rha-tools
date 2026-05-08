# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RHA Tools is a Tauri v2 + React 19 desktop application providing three developer tools in a single window: **Diff Viewer**, **JS Sandbox**, and **OpenAPI Validator**. The frontend is built with Vite + JSX + Tailwind CSS v4; the Rust backend is minimal and mostly unused.

## Commands

```bash
# Frontend-only dev server (Vite, no Rust required)
npm run dev

# Full Tauri desktop app (requires Rust)
npm run tauri dev

# Production build
npm run tauri build

# Clean Rust build artifacts
cd src-tauri && cargo clean && cd ..
```

There are no lint or test scripts configured.

## Architecture

**Entry points:**
- `src/main.jsx` — React bootstrap
- `src/App.jsx` — Renders `<Sidebar>` + the active tool component; reads the first tool from the registry as default
- `src/tools/registry.js` — Single source of truth for all tools (id, label, icon, component)
- `src-tauri/src/lib.rs` — Two Tauri commands (`greet`, `format_json`); not actively used by any tool

**Tool components** (`src/tools/<tool-slug>/index.jsx`):
- `diff-viewer/` — Side-by-side text diff using the `diff` library; supports word/char/line modes; auto-detects content type and formats via the co-located `diff-formatters.js`
- `js-sandbox/` — Runs user JS in hidden iframes (fresh iframe per Script Run, persistent iframe for the Console REPL). Loads external libs via CDN `<script>` tags. Intercepts `console.*` methods to capture output.
- `openapi-validator/` — Validates OpenAPI 3.0/3.1 YAML specs with `@apidevtools/swagger-parser`, then validates JSON payloads against a selected schema using AJV. Handles `$ref` resolution and 3.0→3.1 nullable normalization internally.

**Shared hooks:**
- `src/hooks/use-file-state.js` — `useFileState(toolSlug, filename, default)` reads/writes a single file under `<appDataDir>/<toolSlug>/`. Writes are debounced 500 ms. Returns `[value, setter, isLoaded]`.
- `src/hooks/use-config-state.js` — `useConfigState(toolSlug, defaults)` manages `<appDataDir>/<toolSlug>/config.json` as a key/value store. Returns `[getKey, setKey, isLoaded]`.
- `src/hooks/use-persisted-state.js` — **Deprecated** (localStorage-based). Kept for reference; no tool imports it.

**Storage layout** (`~/Library/Application Support/rha-tools/` on macOS):
```
rha-tools/
├── diff-viewer/
│   ├── version-a.txt
│   ├── version-b.txt
│   └── config.json      # { mode, lineMode, typeA, typeB }
├── js-sandbox/
│   ├── script.js
│   └── config.json      # { libs: [...] }
└── openapi-validator/
    ├── spec.yaml
    ├── payload.json
    └── config.json      # { schema, strict }
```

## Adding a New Tool

1. Create `src/tools/my-tool/index.jsx` (and any tool-specific helpers alongside it)
2. Use `useFileState` for editor/textarea contents; use `useConfigState` for toggles and selections
3. Export a `settingsConfig` constant from `index.jsx` alongside the default component export:
   ```js
   export const settingsConfig = {
     title: "My Tool",
     fields: [
       // { key, type: "select"|"toggle"|"text", label, default, options?, description? }
     ],
   };
   ```
   Export `null` if the tool has no configurable settings.
4. Add one entry to `src/tools/registry.js`, importing and attaching `settingsConfig`:
   ```js
   import MyTool, { settingsConfig as myToolSettings } from "./my-tool";
   { id: "my-tool", label: "My Tool", icon: SomeIcon, component: MyTool, settingsConfig: myToolSettings }
   ```
   `App.jsx` and `Sidebar.jsx` require no changes.

Do **not** persist transient UI state (validation results, loading flags, error lists, console output).

## State Persistence Convention

All tool state that survives page reloads uses `usePersistedState` with keys auto-prefixed to `rha-tools-<tool-slug>-<field>`. The existing key inventory is documented in `.cursor/rules/tool-localstorage-persistence.mdc`.

## Styling

Dark-only theme. Key custom values defined in `src/index.css`:
- Background: `#0b1120` (slate-950)
- Secondary background: `#0f172a` (slate-900)
- Text: slate-300
- Accents: indigo (primary), emerald (success), red (error), amber (warning)
- Monospace font stack: "Share Tech Mono", JetBrains Mono, Fira Code

Monaco editors are themed to match the dark palette.
