import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useConfigState } from "../hooks/use-config-state";
import SettingsFieldRenderer from "./SettingsFieldRenderer";

export default function ToolSettingsSection({ tool }) {
  const { settingsConfig } = tool;
  const [open, setOpen] = useState(false);

  const defaults = Object.fromEntries(
    settingsConfig.fields.map((f) => [f.key, f.default]),
  );
  const [getConfig, setConfig] = useConfigState(tool.id, defaults);

  if (!settingsConfig.fields.length) return null;

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-slate-900/50 px-4 py-3 text-left transition-colors hover:bg-slate-800/50"
      >
        <span className="text-sm font-medium text-slate-200">{settingsConfig.title}</span>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="divide-y divide-slate-800/60 px-4">
          {settingsConfig.fields.map((field) => (
            <SettingsFieldRenderer
              key={field.key}
              field={field}
              value={getConfig(field.key)}
              onChange={(value) => setConfig(field.key, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
