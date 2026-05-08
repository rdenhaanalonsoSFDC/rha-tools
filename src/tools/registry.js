import { GitCompare, Terminal, FileSearch } from "lucide-react";
import DiffViewer, { settingsConfig as diffSettings } from "./diff-viewer";
import JsSandbox, { settingsConfig as sandboxSettings } from "./js-sandbox";
import OpenApiValidator, { settingsConfig as openapiSettings } from "./openapi-validator";

export const TOOLS = [
  { id: "diff",    label: "Diff Viewer",        icon: GitCompare, component: DiffViewer,       settingsConfig: diffSettings },
  { id: "sandbox", label: "JS Sandbox",         icon: Terminal,   component: JsSandbox,        settingsConfig: sandboxSettings },
  { id: "openapi", label: "OpenAPI Validator",  icon: FileSearch, component: OpenApiValidator, settingsConfig: openapiSettings },
];
