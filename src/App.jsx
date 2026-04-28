import { useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import { TOOLS } from "./tools/registry";

export default function App() {
  const [activeTool, setActiveTool] = useState(TOOLS[0].id);

  const ActiveComponent = TOOLS.find((t) => t.id === activeTool).component;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-300">
      <Sidebar activeTool={activeTool} onSelectTool={setActiveTool} />
      <main className="flex-1 overflow-hidden">
        <ActiveComponent />
      </main>
    </div>
  );
}
