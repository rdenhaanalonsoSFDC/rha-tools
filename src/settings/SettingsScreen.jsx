import { TOOLS } from "../tools/registry";
import GlobalSettingsSection from "./GlobalSettingsSection";
import SecretsSection from "./SecretsSection";
import ToolSettingsSection from "./ToolSettingsSection";

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      {children}
    </div>
  );
}

export default function SettingsScreen() {
  const toolsWithSettings = TOOLS.filter((t) => t.settingsConfig?.fields?.length);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-8 px-8 py-8">
        <h1 className="text-xl font-semibold text-slate-100">Settings</h1>

        <Section title="Global">
          <GlobalSettingsSection />
        </Section>

        <Section title="Secrets">
          <SecretsSection />
        </Section>

        {toolsWithSettings.length > 0 && (
          <Section title="Tool Settings">
            <div className="space-y-3">
              {toolsWithSettings.map((tool) => (
                <ToolSettingsSection key={tool.id} tool={tool} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
