import { useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import { TOOLS } from "./tools/registry";
import SettingsScreen from "./settings/SettingsScreen";
import { SecretsProvider } from "./context/SecretsProvider";

export default function App() {
  const [activeTool, setActiveTool] = useState(TOOLS[0].id);

  const ActiveComponent =
    activeTool === "settings"
      ? SettingsScreen
      : (TOOLS.find((t) => t.id === activeTool)?.component ?? TOOLS[0].component);

  return (
    <SecretsProvider>
      <div className="flex h-screen bg-slate-950 text-slate-300">
        <Sidebar activeTool={activeTool} onSelectTool={setActiveTool} />
        <main className="flex-1 overflow-hidden">
          <ActiveComponent />
        </main>
      </div>
    </SecretsProvider>
  );
}
