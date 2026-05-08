import { useState, useContext } from "react";
import { Eye, EyeOff, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { SecretsContext } from "../context/secrets-context";

const NAME_PATTERN = /^[A-Z0-9_]+$/;

export default function SecretsSection() {
  const { allSecretNames, getSecret, setSecret, deleteSecret, isLoaded, error } =
    useContext(SecretsContext);

  const [revealed, setRevealed] = useState(new Set());
  const [editing, setEditing] = useState(null); // { name, value }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
        Initialising secrets store…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-400">
        Failed to initialise secrets store: {error}
      </div>
    );
  }

  function toggleReveal(name) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  async function handleAdd() {
    const name = newName.trim().toUpperCase();
    const value = newValue;

    if (!NAME_PATTERN.test(name)) {
      setAddError("Name must only contain A–Z, 0–9, and underscores.");
      return;
    }
    if (!value) {
      setAddError("Value cannot be empty.");
      return;
    }
    if (allSecretNames.includes(name)) {
      setAddError(`"${name}" already exists.`);
      return;
    }

    setSaving(true);
    try {
      await setSecret(name, value);
      setNewName("");
      setNewValue("");
      setAddError("");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await setSecret(editing.name, editing.value);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name) {
    setSaving(true);
    try {
      await deleteSecret(name);
      setConfirmDelete(null);
      setRevealed((prev) => { const s = new Set(prev); s.delete(name); return s; });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      {allSecretNames.length === 0 ? (
        <div className="px-4 py-4 text-sm text-slate-500">No secrets stored yet.</div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {allSecretNames.map((name) => {
            const isRevealed = revealed.has(name);
            const isEditing = editing?.name === name;
            const isConfirming = confirmDelete === name;

            return (
              <div key={name} className="flex items-center gap-3 px-4 py-3">
                <span className="w-48 shrink-0 font-mono text-sm text-slate-200 truncate" title={name}>
                  {name}
                </span>

                {isEditing ? (
                  <input
                    type="text"
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    autoFocus
                    className="flex-1 rounded border border-slate-600 bg-slate-900 px-2.5 py-1 font-mono text-sm text-slate-200 outline-none focus:border-indigo-500"
                  />
                ) : (
                  <span className="flex-1 font-mono text-sm text-slate-400 select-none">
                    {isRevealed ? getSecret(name) : "••••••••"}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <IconBtn title="Save" onClick={handleSaveEdit} disabled={saving} className="text-emerald-400 hover:text-emerald-300">
                        <Check className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn title="Cancel" onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-300">
                        <X className="h-3.5 w-3.5" />
                      </IconBtn>
                    </>
                  ) : isConfirming ? (
                    <>
                      <span className="text-xs text-red-400 mr-1">Delete?</span>
                      <IconBtn title="Confirm delete" onClick={() => handleDelete(name)} disabled={saving} className="text-red-400 hover:text-red-300">
                        <Check className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn title="Cancel" onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-slate-300">
                        <X className="h-3.5 w-3.5" />
                      </IconBtn>
                    </>
                  ) : (
                    <>
                      <IconBtn title={isRevealed ? "Hide" : "Reveal"} onClick={() => toggleReveal(name)}>
                        {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </IconBtn>
                      <IconBtn title="Edit" onClick={() => setEditing({ name, value: getSecret(name) ?? "" })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn title="Delete" onClick={() => setConfirmDelete(name)} className="hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new secret */}
      <div className="border-t border-slate-800 bg-slate-900/30 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => { setNewName(e.target.value.toUpperCase()); setAddError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="SECRET_NAME"
            spellCheck={false}
            className="w-48 shrink-0 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-slate-300 outline-none focus:border-indigo-500 placeholder:text-slate-600"
          />
          <input
            type="password"
            value={newValue}
            onChange={(e) => { setNewValue(e.target.value); setAddError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="value"
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-slate-300 outline-none focus:border-indigo-500 placeholder:text-slate-600"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim() || !newValue}
            className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        {addError && <p className="text-xs text-red-400">{addError}</p>}
      </div>
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled, className = "" }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1 rounded text-slate-500 transition-colors hover:text-slate-200 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
