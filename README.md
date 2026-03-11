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
react-diff-viewer-continued	Vista de diferencias
@apidevtools/swagger-parser	Validación OpenAPI 3.0/3.1
ajv, ajv-formats	Validación JSON Schema
yaml	Parsing YAML
Las 3 herramientas
1. Diff Viewer
Dos paneles de texto (Original vs Modificado)
Toggle entre modos: Line by Line, Word by Word, Character, Sentence
Vista Split o Unified
Botones para copiar y limpiar
Resaltado de diferencias con tema oscuro personalizado
2. JS Sandbox
Editor Monaco con sintaxis highlighting para JavaScript
Boton Run que ejecuta via new Function() con console interceptado
Panel de consola inferior con timestamps estilo Chrome DevTools
Soporta console.log, .warn, .error, .info
Separadores visuales entre ejecuciones
3. OpenAPI Validator
Editor Monaco para YAML (spec OpenAPI)
Validacion de sintaxis YAML
Validacion contra estandar OpenAPI 3.0/3.1 via swagger-parser
Selector de schemas disponibles en el spec
Editor JSON para payload
Validacion del payload contra el schema seleccionado via ajv
Panel de errores con mensajes claros y rutas
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



openapi-payloadvalidator/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── index.css                          # Tailwind v4 + tema oscuro
│   ├── App.jsx                            # Router principal
│   └── components/
│       ├── layout/
│       │   └── Sidebar.jsx                # Navegación lateral
│       └── tools/
│           ├── DiffViewer.jsx             # Comparador de texto
│           ├── JsSandbox.jsx              # Consola JavaScript
│           └── OpenApiValidator.jsx       # Validador OpenAPI
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        ├── main.rs
        └── lib.rs                         # Comandos Tauri (greet, format_json)