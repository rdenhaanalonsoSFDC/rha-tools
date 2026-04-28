import { GitCompareArrows, Terminal, FileSearch } from "lucide-react";
import DiffViewer from "./diff-viewer";
import JsSandbox from "./js-sandbox";
import OpenApiValidator from "./openapi-validator";

export const TOOLS = [
  { id: "diff",    label: "Diff Viewer",      icon: GitCompareArrows, component: DiffViewer },
  { id: "sandbox", label: "JS Sandbox",        icon: Terminal,         component: JsSandbox },
  { id: "openapi", label: "OpenAPI Validator", icon: FileSearch,       component: OpenApiValidator },
];
