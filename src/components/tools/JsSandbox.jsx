import { useState, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { Play, Trash2, Clock } from "lucide-react";
import { usePersistedState } from "../../hooks/use-persisted-state";

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
 * Formats a timestamp for the console output.
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
 * Serializes a value for console display, handling circular references.
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

export default function JsSandbox() {
  const [code, setCode] = usePersistedState("js-sandbox-code", DEFAULT_CODE);
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const consoleEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  const handleRun = useCallback(() => {
    setIsRunning(true);
    const newLogs = [];

    const mockConsole = {
      log: (...args) => {
        newLogs.push({
          type: "log",
          content: args.map(serialize).join(" "),
          timestamp: new Date(),
        });
      },
      warn: (...args) => {
        newLogs.push({
          type: "warn",
          content: args.map(serialize).join(" "),
          timestamp: new Date(),
        });
      },
      error: (...args) => {
        newLogs.push({
          type: "error",
          content: args.map(serialize).join(" "),
          timestamp: new Date(),
        });
      },
      info: (...args) => {
        newLogs.push({
          type: "info",
          content: args.map(serialize).join(" "),
          timestamp: new Date(),
        });
      },
    };

    try {
      const fn = new Function("console", code);
      fn(mockConsole);

      setLogs((prev) => [
        ...prev,
        { type: "separator", content: "Execution completed", timestamp: new Date() },
        ...newLogs,
      ]);
    } catch (error) {
      setLogs((prev) => [
        ...prev,
        { type: "separator", content: "Execution failed", timestamp: new Date() },
        {
          type: "error",
          content: `${error.name}: ${error.message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsRunning(false);
      scrollToBottom();
    }
  }, [code, scrollToBottom]);

  const handleClear = useCallback(() => {
    setLogs([]);
  }, []);

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

  const getLogStyle = (type) => {
    switch (type) {
      case "error":
        return "text-red-400 bg-red-500/5";
      case "warn":
        return "text-amber-400 bg-amber-500/5";
      case "info":
        return "text-blue-400";
      case "separator":
        return "text-slate-600 italic";
      default:
        return "text-slate-300";
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <h2 className="text-lg font-semibold text-slate-100">JS Sandbox</h2>
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
      </header>

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
              Loading editor...
            </div>
          }
        />
      </div>

      <div className="flex h-64 flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <span className="text-xs font-medium text-slate-500 uppercase">Console</span>
          {logs.length > 0 && (
            <span className="text-xs text-slate-600">{logs.filter((l) => l.type !== "separator").length} entries</span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-950 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-600">
              Console output will appear here...
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
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
