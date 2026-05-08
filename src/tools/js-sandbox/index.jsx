import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Editor from "@monaco-editor/react";
import {
  Play,
  Trash2,
  Clock,
  Package,
  Plus,
  X,
  ChevronDown,
  Terminal,
  Code2,
  RotateCw,
} from "lucide-react";
import { useFileState } from "../../hooks/use-file-state";
import { useConfigState } from "../../hooks/use-config-state";

const DEFAULT_CODE = `// Welcome to the JS Sandbox!
// Write JavaScript code and click "Run" to execute it.

const greet = (name) => \`Hello, \${name}!\`;
console.log(greet("Developer"));

const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Doubled:", doubled);

const sum = numbers.reduce((acc, n) => acc + n, 0);
console.log("Sum:", sum);
`;

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 12 },
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
};

/**
 * Formats a timestamp for the output panel.
 * @param {Date} date
 * @returns {string}
 */
const formatTimestamp = (date) =>
  date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

/**
 * Serializes a value for Script Run console output.
 * @param {*} value
 * @returns {string}
 */
const serialize = (value) => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "function") return value.toString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

/**
 * Formats a return value for REPL display (strings get quotes, functions show
 * their signature, etc.). Works across iframe realms.
 * @param {*} value
 * @returns {string}
 */
const inspectRepl = (value) => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "function") return `ƒ ${value.name || "(anonymous)"}()`;
  if (typeof value === "symbol") return value.toString();
  // Cross-realm error detection via duck-typing
  if (
    value &&
    typeof value.name === "string" &&
    typeof value.message === "string" &&
    typeof value.stack === "string"
  ) {
    return `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const SLUG = "js-sandbox";
const CONFIG_DEFAULTS = { libs: [] };

export default function JsSandbox() {
  const [code, setCode] = useFileState(SLUG, "script.js", DEFAULT_CODE);
  const [getConfig, setConfig] = useConfigState(SLUG, CONFIG_DEFAULTS);

  const libs = getConfig("libs");
  const setLibs = useCallback((v) => setConfig("libs", v), [setConfig]);

  // Libraries panel
  const [libsOpen, setLibsOpen] = useState(false);
  const [newLibUrl, setNewLibUrl] = useState("");

  // Tab selection
  const [activeTab, setActiveTab] = useState("script");

  // ── Script Run state ───────────────────────────────────────────────────
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const scriptEndRef = useRef(null);

  // ── Console REPL state ─────────────────────────────────────────────────
  const [replEntries, setReplEntries] = useState([]);
  const [replInput, setReplInput] = useState("");
  const [replHistory, setReplHistory] = useState([]);
  const [replHistoryIdx, setReplHistoryIdx] = useState(-1);
  const [replReady, setReplReady] = useState(false);
  const [replLoading, setReplLoading] = useState(false);
  const [replLibsSig, setReplLibsSig] = useState(null);

  const replIframeRef = useRef(null);
  const replInputRef = useRef(null);
  const replEndRef = useRef(null);

  // Clean up the persistent REPL iframe when the component unmounts.
  useEffect(() => {
    return () => {
      if (replIframeRef.current) {
        try { document.body.removeChild(replIframeRef.current); } catch { /* ignore */ }
      }
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────

  const scrollScriptToBottom = useCallback(() => {
    setTimeout(() => scriptEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const scrollReplToBottom = useCallback(() => {
    setTimeout(() => replEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const addReplEntry = useCallback((type, content) => {
    setReplEntries((prev) => [...prev, { type, content, timestamp: new Date() }]);
  }, []);

  // ── Library management ─────────────────────────────────────────────────

  const handleAddLib = useCallback(() => {
    const url = newLibUrl.trim();
    if (!url || libs.includes(url)) return;
    setLibs([...libs, url]);
    setNewLibUrl("");
  }, [newLibUrl, libs, setLibs]);

  const handleRemoveLib = useCallback(
    (idx) => setLibs(libs.filter((_, i) => i !== idx)),
    [libs, setLibs],
  );

  const handleLibChange = useCallback(
    (idx, url) => {
      const updated = [...libs];
      updated[idx] = url;
      setLibs(updated);
    },
    [libs, setLibs],
  );

  // ── Script Run ─────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    const newLogs = [];

    const pushLog = (type, content) =>
      newLogs.push({ type, content, timestamp: new Date() });

    const mockConsole = {
      log: (...args) => pushLog("log", args.map(serialize).join(" ")),
      warn: (...args) => pushLog("warn", args.map(serialize).join(" ")),
      error: (...args) => pushLog("error", args.map(serialize).join(" ")),
      info: (...args) => pushLog("info", args.map(serialize).join(" ")),
    };

    let iframe;
    try {
      iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      const iframeWin = iframe.contentWindow;
      const iframeDoc = iframe.contentDocument;

      iframeWin.console = mockConsole;

      iframeWin.onerror = (message, source, line, col) => {
        const label = source ? source.split("/").pop() : "library";
        pushLog("error", `[${label}:${line}:${col}] ${message}`);
        return true;
      };
      iframeWin.onunhandledrejection = (ev) => {
        const reason = ev.reason instanceof Error ? ev.reason.message : String(ev.reason);
        pushLog("error", `[Unhandled Promise rejection] ${reason}`);
      };

      const activeLibs = libs.filter((url) => url.trim());
      if (activeLibs.length > 0) {
        pushLog("info", `Loading ${activeLibs.length} librar${activeLibs.length === 1 ? "y" : "ies"}…`);

        for (const url of activeLibs) {
          try {
            await new Promise((resolve, reject) => {
              const script = iframeDoc.createElement("script");
              script.src = url;
              const timeout = setTimeout(() => reject(new Error(`Timeout loading: ${url}`)), 15000);
              script.onload = () => { clearTimeout(timeout); resolve(); };
              script.onerror = () => { clearTimeout(timeout); reject(new Error(`Failed to load: ${url}`)); };
              iframeDoc.head.appendChild(script);
            });
            pushLog("info", `Loaded ${url}`);
          } catch (err) {
            pushLog("error", err.message);
          }
        }
      }

      const asyncFn = new iframeWin.Function("console", `return (async () => { ${code} })()`);
      await asyncFn(mockConsole);

      setLogs((prev) => [
        ...prev,
        { type: "separator", content: "Execution completed", timestamp: new Date() },
        ...newLogs,
      ]);
    } catch (error) {
      setLogs((prev) => [
        ...prev,
        { type: "separator", content: "Execution failed", timestamp: new Date() },
        ...newLogs,
        { type: "error", content: `${error.name}: ${error.message}`, timestamp: new Date() },
      ]);
    } finally {
      if (iframe) document.body.removeChild(iframe);
      setIsRunning(false);
      scrollScriptToBottom();
    }
  }, [code, libs, scrollScriptToBottom]);

  const handleClear = useCallback(() => setLogs([]), []);

  // ── Console REPL ───────────────────────────────────────────────────────

  /**
   * Creates (or re-creates) the persistent iframe, loads external libraries
   * into it, and marks the console as ready.
   */
  const initReplConsole = useCallback(async () => {
    // Tear down any existing iframe
    if (replIframeRef.current) {
      try { document.body.removeChild(replIframeRef.current); } catch { /* ignore */ }
      replIframeRef.current = null;
    }

    setReplLoading(true);
    setReplReady(false);

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    // Assign immediately to prevent a double-init race on rapid tab clicks.
    replIframeRef.current = iframe;

    const iframeWin = iframe.contentWindow;
    const iframeDoc = iframe.contentDocument;

    // Route the iframe's console to the REPL output panel.
    iframeWin.console = {
      log: (...args) => addReplEntry("log", args.map(serialize).join(" ")),
      warn: (...args) => addReplEntry("warn", args.map(serialize).join(" ")),
      error: (...args) => addReplEntry("error", args.map(serialize).join(" ")),
      info: (...args) => addReplEntry("info", args.map(serialize).join(" ")),
    };

    // Surface uncaught errors from library scripts in the REPL panel.
    iframeWin.onerror = (message, source, line, col) => {
      const label = source ? source.split("/").pop() : "library";
      addReplEntry("error", `[${label}:${line}:${col}] ${message}`);
      return true;
    };
    iframeWin.onunhandledrejection = (ev) => {
      const reason = ev.reason?.message ?? String(ev.reason);
      addReplEntry("error", `[Unhandled rejection] ${reason}`);
    };

    const activeLibs = libs.filter((url) => url.trim());
    if (activeLibs.length > 0) {
      addReplEntry("system", `Loading ${activeLibs.length} librar${activeLibs.length === 1 ? "y" : "ies"}…`);
      for (const url of activeLibs) {
        try {
          await new Promise((resolve, reject) => {
            const script = iframeDoc.createElement("script");
            script.src = url;
            const timeout = setTimeout(() => reject(new Error(`Timeout: ${url}`)), 15000);
            script.onload = () => { clearTimeout(timeout); resolve(); };
            script.onerror = () => { clearTimeout(timeout); reject(new Error(`Failed to load: ${url}`)); };
            iframeDoc.head.appendChild(script);
          });
          addReplEntry("system", `✓ Loaded ${url.split("/").pop()}`);
        } catch (err) {
          addReplEntry("error", err.message);
        }
      }
    }

    setReplLibsSig(JSON.stringify(libs));
    setReplReady(true);
    setReplLoading(false);
    addReplEntry(
      "system",
      activeLibs.length > 0
        ? "Console ready."
        : "Console ready. Add external libraries above for global access.",
    );
    setTimeout(() => replInputRef.current?.focus(), 50);
  }, [libs, addReplEntry]);

  /**
   * Executes a REPL command inside the persistent iframe.
   *
   * A <script> element is injected so that `eval()` runs at the iframe's
   * top-level scope — this makes `var` and function declarations persist
   * between commands (the same behaviour as the Chrome DevTools console).
   */
  const executeReplCommand = useCallback((cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed || !replIframeRef.current || !replReady) return;

    const iframeWin = replIframeRef.current.contentWindow;
    const iframeDoc = replIframeRef.current.contentDocument;

    addReplEntry("input", trimmed);
    setReplHistory((prev) => [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 200));
    setReplHistoryIdx(-1);
    setReplInput("");

    // JSON.stringify safely encodes the user command as a JS string literal
    // so it can be passed to eval() without injection issues.
    const safeCmd = JSON.stringify(trimmed);

    new Promise((resolve, reject) => {
      iframeWin.__replResolve__ = resolve;
      iframeWin.__replReject__ = reject;
      const script = iframeDoc.createElement("script");
      script.text =
        `try { window.__replResult__ = eval(${safeCmd}); window.__replResolve__(true); }` +
        `catch (__e__) { window.__replReject__(__e__); }`;
      iframeDoc.head.appendChild(script);
      iframeDoc.head.removeChild(script);
    })
      .then(() => {
        const result = iframeWin.__replResult__;
        iframeWin.__replResult__ = undefined;

        const isThenable = result != null && typeof result.then === "function";
        if (isThenable) {
          addReplEntry("return", "Promise { <pending> }");
          result.then(
            (val) => {
              addReplEntry("return", `↳ resolved: ${inspectRepl(val)}`);
              scrollReplToBottom();
            },
            (err) => {
              addReplEntry("error", `↳ rejected: ${err?.message ?? String(err)}`);
              scrollReplToBottom();
            },
          );
        } else if (result !== undefined) {
          addReplEntry("return", inspectRepl(result));
        }
      })
      .catch((err) => {
        addReplEntry("error", `${err?.name ?? "Error"}: ${err?.message ?? String(err)}`);
      })
      .finally(scrollReplToBottom);
  }, [replReady, addReplEntry, scrollReplToBottom]);

  const handleReplKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeReplCommand(replInput);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (replHistory.length === 0) return;
      const newIdx = Math.min(replHistoryIdx + 1, replHistory.length - 1);
      setReplHistoryIdx(newIdx);
      setReplInput(replHistory[newIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (replHistoryIdx <= 0) {
        setReplHistoryIdx(-1);
        setReplInput("");
      } else {
        const newIdx = replHistoryIdx - 1;
        setReplHistoryIdx(newIdx);
        setReplInput(replHistory[newIdx]);
      }
    } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setReplEntries([]);
    }
  }, [replInput, replHistory, replHistoryIdx, executeReplCommand]);

  const handleReloadRepl = useCallback(() => {
    setReplEntries([]);
    initReplConsole();
  }, [initReplConsole]);

  const handleClearRepl = useCallback(() => setReplEntries([]), []);

  // ── Editor mount ───────────────────────────────────────────────────────

  const handleEditorMount = (editor, monaco) => {
    monaco.editor.defineTheme("rha-tools-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0b1120",
        "editor.foreground": "#cbd5e1",
        "editorLineNumber.foreground": "#475569",
        "editorLineNumber.activeForeground": "#94a3b8",
        "editor.selectionBackground": "#334155",
        "editor.lineHighlightBackground": "#1e293b",
      },
    });
    monaco.editor.setTheme("rha-tools-dark");
  };

  // ── Style helpers ──────────────────────────────────────────────────────

  const getLogStyle = (type) => {
    switch (type) {
      case "error": return "text-red-400 bg-red-500/5";
      case "warn": return "text-amber-400 bg-amber-500/5";
      case "info": return "text-blue-400";
      case "separator": return "text-slate-600 italic";
      default: return "text-slate-300";
    }
  };

  const getReplEntryStyle = (type) => {
    switch (type) {
      case "error": return "text-red-400";
      case "warn": return "text-amber-400";
      case "info": return "text-blue-400";
      case "return": return "text-cyan-400";
      case "input": return "text-slate-100";
      case "system": return "text-slate-500";
      default: return "text-slate-300";
    }
  };

  const libsDirty = replLibsSig !== null && JSON.stringify(libs) !== replLibsSig;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <h2 className="text-lg font-semibold text-slate-100">JS Sandbox</h2>
        {activeTab === "script" ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Run
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearRepl}
              className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              onClick={handleReloadRepl}
              disabled={replLoading}
              className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${replLoading ? "animate-spin" : ""}`} />
              Reload
            </button>
          </div>
        )}
      </header>

      {/* External Libraries */}
      <div className="border-b border-slate-800">
        <button
          onClick={() => setLibsOpen(!libsOpen)}
          className="flex w-full cursor-pointer items-center gap-2 bg-transparent px-6 py-2 text-xs text-slate-400 transition-colors hover:text-slate-200"
        >
          <Package className="h-3.5 w-3.5" />
          <span className="font-medium uppercase">External Libraries</span>
          {libs.length > 0 && (
            <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-xs text-indigo-400">
              {libs.length}
            </span>
          )}
          <ChevronDown
            className={`ml-auto h-3.5 w-3.5 transition-transform ${libsOpen ? "rotate-180" : ""}`}
          />
        </button>

        {libsOpen && (
          <div className="max-h-48 space-y-1.5 overflow-y-auto px-6 pb-3">
            {libs.map((url, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={url}
                  onChange={(e) => handleLibChange(idx, e.target.value)}
                  spellCheck={false}
                  className="flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-300 outline-none focus:border-slate-500"
                />
                <button
                  onClick={() => handleRemoveLib(idx)}
                  className="cursor-pointer rounded border-none bg-transparent p-1 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={newLibUrl}
                onChange={(e) => setNewLibUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddLib()}
                placeholder="https://cdn.jsdelivr.net/npm/library@version/dist/library.min.js"
                spellCheck={false}
                className="flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-400 outline-none placeholder:text-slate-600 focus:border-indigo-500"
              />
              <button
                onClick={handleAddLib}
                disabled={!newLibUrl.trim()}
                className="cursor-pointer rounded border-none bg-slate-800 p-1 text-slate-400 transition-colors hover:bg-indigo-600 hover:text-white disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-slate-800 bg-slate-900/40">
        <button
          onClick={() => setActiveTab("script")}
          className={`flex items-center gap-1.5 border-b-2 px-5 py-2 text-xs font-medium transition-colors ${
            activeTab === "script"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          Script Run
        </button>
        <button
          onClick={() => {
            setActiveTab("console");
            if (!replIframeRef.current) {
              initReplConsole();
            }
          }}
          className={`flex items-center gap-1.5 border-b-2 px-5 py-2 text-xs font-medium transition-colors ${
            activeTab === "console"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          Console
        </button>
      </div>

      {/* ── Script Run Tab ─────────────────────────────────────────────── */}
      {activeTab === "script" && (
        <>
          <div className="flex-1 overflow-hidden border-b border-slate-800">
            <Editor
              height="100%"
              language="javascript"
              value={code}
              onChange={(value) => setCode(value ?? "")}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={EDITOR_OPTIONS}
              loading={
                <div className="flex h-full items-center justify-center text-slate-500">
                  Loading editor…
                </div>
              }
            />
          </div>

          <div className="flex h-64 flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
              <span className="text-xs font-medium uppercase text-slate-500">Output</span>
              {logs.length > 0 && (
                <span className="text-xs text-slate-600">
                  {logs.filter((l) => l.type !== "separator").length} entries
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-950 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-600">
                  Run your script to see output here
                </div>
              ) : (
                <div className="p-2">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 rounded px-2 py-1 ${getLogStyle(log.type)}`}
                    >
                      {log.type !== "separator" && (
                        <span className="shrink-0 text-slate-600">
                          <Clock className="mr-1 inline h-3 w-3" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                      )}
                      {log.type === "separator" ? (
                        <div className="flex w-full items-center gap-2 text-slate-600">
                          <div className="h-px flex-1 bg-slate-800" />
                          <span>{log.content}</span>
                          <div className="h-px flex-1 bg-slate-800" />
                        </div>
                      ) : (
                        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all">
                          {log.content}
                        </pre>
                      )}
                    </div>
                  ))}
                  <div ref={scriptEndRef} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Console Tab ────────────────────────────────────────────────── */}
      {activeTab === "console" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Libraries-changed banner */}
          {libsDirty && (
            <div className="flex shrink-0 items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
              <span>External libraries changed — reload to apply.</span>
              <button
                onClick={handleReloadRepl}
                className="rounded bg-amber-500/20 px-2 py-0.5 font-medium transition-colors hover:bg-amber-500/30"
              >
                Reload
              </button>
            </div>
          )}

          {/* REPL output — clicking the area focuses the input */}
          <div
            className="flex-1 overflow-y-auto bg-slate-950 font-mono text-xs"
            onClick={() => replInputRef.current?.focus()}
          >
            {replEntries.length === 0 ? (
              <div className="flex h-full items-center justify-center select-none text-slate-600">
                {replLoading ? "Initialising…" : "Type a JavaScript expression below"}
              </div>
            ) : (
              <div className="py-1">
                {replEntries.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-start px-3 py-0.5 ${getReplEntryStyle(entry.type)}`}
                  >
                    {/* Gutter icon */}
                    <span className="mr-2 w-4 shrink-0 select-none text-center">
                      {entry.type === "input" && (
                        <span className="font-bold text-indigo-400">›</span>
                      )}
                      {entry.type === "return" && (
                        <span className="text-cyan-600">←</span>
                      )}
                      {entry.type === "error" && "✖"}
                      {entry.type === "warn" && "⚠"}
                      {entry.type === "system" && "ℹ"}
                    </span>
                    <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all">
                      {entry.content}
                    </pre>
                  </div>
                ))}
                <div ref={replEndRef} />
              </div>
            )}
          </div>

          {/* REPL input line */}
          <div
            className={`flex shrink-0 items-center gap-2 border-t border-slate-700 bg-slate-950 px-3 py-2 transition-opacity ${
              !replReady ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <span className="select-none font-bold text-indigo-400">›</span>
            <input
              ref={replInputRef}
              value={replInput}
              onChange={(e) => setReplInput(e.target.value)}
              onKeyDown={handleReplKeyDown}
              disabled={!replReady}
              placeholder={
                replLoading
                  ? "Loading…"
                  : replReady
                  ? "JS expression or statement  (↑↓ history  ·  Ctrl+L clear)"
                  : ""
              }
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent font-mono text-xs text-slate-100 outline-none placeholder:font-sans placeholder:text-slate-600"
            />
          </div>
        </div>
      )}
    </div>
  );
}
