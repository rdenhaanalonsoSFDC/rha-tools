import { useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import DiffViewer from "./components/tools/DiffViewer";
import JsSandbox from "./components/tools/JsSandbox";
import OpenApiValidator from "./components/tools/OpenApiValidator";

const TOOLS = {
  diff: { component: DiffViewer, label: "Diff Viewer" },
  sandbox: { component: JsSandbox, label: "JS Sandbox" },
  openapi: { component: OpenApiValidator, label: "OpenAPI Validator" },
};

export default function App() {
  const [activeTool, setActiveTool] = useState("diff");

  const ActiveComponent = TOOLS[activeTool].component;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-300">
      <Sidebar activeTool={activeTool} onSelectTool={setActiveTool} />
      <main className="flex-1 overflow-hidden">
        <ActiveComponent />
      </main>
    </div>
  );
}
