export default function SettingsFieldRenderer({ field, value, onChange }) {
  const id = `settings-field-${field.key}`;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm text-slate-200 cursor-pointer">
          {field.label}
        </label>
        {field.description && (
          <p className="mt-0.5 text-xs text-slate-500">{field.description}</p>
        )}
      </div>

      <div className="shrink-0">
        {field.type === "toggle" && (
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-indigo-500"
          />
        )}

        {field.type === "select" && (
          <select
            id={id}
            value={value ?? field.default}
            onChange={(e) => onChange(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-sm text-slate-300 outline-none focus:border-indigo-500"
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {field.type === "text" && (
          <input
            id={id}
            type="text"
            value={value ?? field.default ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-sm text-slate-300 outline-none focus:border-indigo-500 placeholder:text-slate-600"
          />
        )}
      </div>
    </div>
  );
}
