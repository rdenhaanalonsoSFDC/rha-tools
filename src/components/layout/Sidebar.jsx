import { GitCompareArrows, Terminal, FileSearch, Wrench } from "lucide-react";

const NAV_ITEMS = [
  { id: "diff", label: "Diff Viewer", icon: GitCompareArrows },
  { id: "sandbox", label: "JS Sandbox", icon: Terminal },
  { id: "openapi", label: "OpenAPI Validator", icon: FileSearch },
];

export default function Sidebar({ activeTool, onSelectTool }) {
  return (
    <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
        <Wrench className="h-5 w-5 text-indigo-400" />
        <h1 className="text-lg font-semibold text-slate-100">RHA Tools</h1>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTool === id;
          return (
            <button
              key={id}
              onClick={() => onSelectTool(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-5 py-3">
        <p className="text-xs text-slate-600">v0.1.0 &middot; Tauri + React</p>
      </div>
    </aside>
  );
}
