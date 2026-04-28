# Tauri + React

This template should help get you started developing with Tauri and React in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

Dependencias instaladas
Paquete	Propósito
react, react-dom	Framework UI
@tauri-apps/api, @tauri-apps/plugin-opener	Comunicación Tauri
tailwindcss, @tailwindcss/vite	Estilos (v4)
lucide-react	Iconos
@monaco-editor/react	Editor de código (JS Sandbox + OpenAPI)
diff	Algoritmos de diferencias (word/char/line)
js-beautify, sql-formatter, yaml	Formateo de contenido en Diff Viewer
@apidevtools/swagger-parser	Validación OpenAPI 3.0/3.1
ajv, ajv-formats	Validación JSON Schema
yaml	Parsing YAML
Las 3 herramientas
1. Diff Viewer
Dos paneles de texto (Version A vs Version B)
Toggle entre modos: word, char, line
Mostrar todas las líneas o solo las cambiadas
Auto-detección de tipo de contenido al pegar
Botones para formatear/beautify y limpiar
Soporte para carga de archivos y drag-and-drop
2. JS Sandbox
Editor Monaco con sintaxis highlighting para JavaScript
Tab "Script Run": ejecuta código en un iframe aislado con console interceptado
Tab "Console": REPL persistente con historial (igual que Chrome DevTools)
Carga de librerías externas via CDN
Soporta console.log, .warn, .error, .info
Separadores visuales entre ejecuciones
3. OpenAPI Validator
Editor Monaco para YAML (spec OpenAPI)
Validacion de sintaxis YAML
Validacion contra estandar OpenAPI 3.0/3.1 via swagger-parser
Selector de schemas disponibles en el spec
Editor JSON para payload
Validacion del payload contra el schema seleccionado via ajv
Modo estricto (rechaza propiedades adicionales)
Panel de errores con mensajes claros, rutas y números de línea
Backend Tauri (Rust)
Comando greet (ejemplo de comunicacion frontend-backend)
Comando format_json (formateo de JSON desde Rust)
Ventana configurada a 1400x900 con minimo 1000x600



# Dev mode (frontend only)
npm run dev

# Dev mode completo con Tauri (requiere Rust instalado)
npm run tauri dev

# Build de produccion
npm run tauri build

# Clean build
cd src-tauri && cargo clean & cd ..



# Adding a new tool

1. Create `src/tools/my-tool/index.jsx` with a default export (and any tool-specific helpers alongside it).
2. Use `usePersistedState` instead of `useState` for all user-editable state. Key pattern: `<tool-slug>-<field>` (e.g. `my-tool-input`).
3. Add one entry to `src/tools/registry.js`:
   ```js
   { id: "my-tool", label: "My Tool", icon: SomeIcon, component: MyTool }
   ```
   Import the icon from `lucide-react` and the component from `./my-tool`.

That's it — `App.jsx` and `Sidebar.jsx` do not need to be touched.

---

rha-tools/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── index.css                          # Tailwind v4 + tema oscuro
│   ├── App.jsx                            # Router principal
│   ├── components/
│   │   └── layout/
│   │       └── Sidebar.jsx                # Navegación lateral
│   ├── hooks/
│   │   └── use-persisted-state.js         # Hook compartido para localStorage
│   └── tools/
│       ├── registry.js                    # Registro central de herramientas
│       ├── diff-viewer/
│       │   ├── index.jsx                  # Comparador de texto
│       │   └── diff-formatters.js         # Utilidades de formateo
│       ├── js-sandbox/
│       │   └── index.jsx                  # Consola JavaScript
│       └── openapi-validator/
│           └── index.jsx                  # Validador OpenAPI
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        ├── main.rs
        └── lib.rs                         # Comandos Tauri (greet, format_json)