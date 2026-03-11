import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { diffWords, diffChars, diffLines } from "diff";
import { ArrowRightLeft, Trash2, FileUp, Wand2 } from "lucide-react";

const DIFF_FNS = {
  word: (a, b) => diffWords(a, b, { ignoreWhitespace: false }),
  char: diffChars,
  line: diffLines,
};

/**
 * Persisted state hook backed by localStorage.
 * @param {string} key
 * @param {string} defaultValue
 */
function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? defaultValue);
  const set = useCallback(
    (v) => {
      setValue(v);
      localStorage.setItem(key, v);
    },
    [key],
  );
  return [value, set];
}

/**
 * Splits a flat diff-parts array into lines (arrays of parts per visual line),
 * matching the difftext.com X0 algorithm.
 */
function splitIntoLines(parts) {
  let lines = [];
  let currentLine = [];

  parts.forEach((part) => {
    const segments = part.value.split("\n");
    segments.forEach((segment, idx) => {
      const isNewlineBoundary = segment === "" && idx < segments.length - 1;
      const hasChange = part.added || part.removed;

      if (isNewlineBoundary) {
        if (!hasChange) {
          lines.push(currentLine);
          currentLine = [];
          return;
        }
        if (currentLine.length === 0) {
          lines.push([{ ...part, value: segment }]);
          return;
        }
        lines.push(currentLine);
        currentLine = [{ ...part, value: segment }];
        return;
      }
      currentLine.push({ ...part, value: segment });
    });
  });

  if (currentLine.length) lines.push(currentLine);

  lines = lines.map((line) =>
    line.filter((p, i) => {
      const isNewline = p.value === "\n";
      const next = line[i + 1];
      return !(isNewline && (next?.added || next?.removed));
    }),
  );

  return lines;
}

function isJsonString(str) {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

export default function DiffViewer() {
  const [textA, setTextA] = usePersistedState("rha-tools-diffA", "");
  const [textB, setTextB] = usePersistedState("rha-tools-diffB", "");
  const [diffMode, setDiffMode] = usePersistedState("rha-tools-diffMode", "word");
  const [lineMode, setLineMode] = usePersistedState("rha-tools-lineMode", "all");
  const [isJson, setIsJson] = useState(false);

  const fileRefA = useRef(null);
  const fileRefB = useRef(null);

  useEffect(() => {
    setIsJson(isJsonString(textA) && isJsonString(textB));
  }, [textA, textB]);

  const handleFileLoad = useCallback(
    (setter) => (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target.result);
      reader.readAsText(file);
      e.target.value = "";
    },
    [],
  );

  const handleDrop = useCallback(
    (setter) => (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target.result);
      reader.readAsText(file);
    },
    [],
  );

  const handleSwap = useCallback(() => {
    const a = textA;
    setTextA(textB);
    setTextB(a);
  }, [textA, textB, setTextA, setTextB]);

  const handleClear = useCallback(() => {
    setTextA("");
    setTextB("");
  }, [setTextA, setTextB]);

  const handleFormatJson = useCallback(() => {
    try {
      const a = JSON.parse(textA);
      const b = JSON.parse(textB);

      const sortKeys = (obj) => {
        if (Array.isArray(obj)) return obj;
        const sorted = {};
        Object.keys(obj)
          .sort()
          .forEach((k) => {
            sorted[k] = obj[k];
          });
        return sorted;
      };

      setTextA(JSON.stringify(sortKeys(a), null, 2));
      setTextB(JSON.stringify(sortKeys(b), null, 2));
    } catch {
      /* ignore */
    }
  }, [textA, textB, setTextA, setTextB]);

  const diffParts = useMemo(() => {
    if (!textA && !textB) return [];
    return DIFF_FNS[diffMode](textA, textB);
  }, [textA, textB, diffMode]);

  const hasInput = textA !== "" || textB !== "";

  return (
    <div className="flex h-full flex-col" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
      {/* Text Input Area */}
      <div className="flex min-h-0 flex-1 gap-[5px] p-[15px] pb-0">
        <TextPanel
          label="Version A"
          value={textA}
          onChange={setTextA}
          fileRef={fileRefA}
          onFileLoad={handleFileLoad(setTextA)}
          onDrop={handleDrop(setTextA)}
        />

        {/* Icon Pane */}
        <div className="mt-[35px] mb-[23px] flex flex-col justify-between">
          <div className="flex flex-col items-center gap-[5px]">
            <IconButton title="Swap inputs" onClick={handleSwap}>
              <ArrowRightLeft strokeWidth={1.5} size={24} />
            </IconButton>
            <IconButton title="Clear text" onClick={handleClear}>
              <Trash2 strokeWidth={1.5} size={24} />
            </IconButton>
          </div>
          <div className="flex flex-col items-center gap-[5px]">
            {isJson && (
              <IconButton title="Format JSON" onClick={handleFormatJson}>
                <Wand2 strokeWidth={1.5} size={24} />
              </IconButton>
            )}
          </div>
        </div>

        <TextPanel
          label="Version B"
          value={textB}
          onChange={setTextB}
          fileRef={fileRefB}
          onFileLoad={handleFileLoad(setTextB)}
          onDrop={handleDrop(setTextB)}
        />
      </div>

      {/* Mode Toggles */}
      <div className="flex flex-col gap-0 px-[15px] pt-1 pb-2">
        <ModeRow label="Compare by:">
          {["word", "char", "line"].map((m) => (
            <ToggleButton key={m} selected={diffMode === m} onClick={() => setDiffMode(m)}>
              {m}
            </ToggleButton>
          ))}
        </ModeRow>
        <ModeRow label="Show lines:">
          <ToggleButton selected={lineMode === "all"} onClick={() => setLineMode("all")}>
            all
          </ToggleButton>
          <ToggleButton selected={lineMode === "changed"} onClick={() => setLineMode("changed")}>
            only changed
          </ToggleButton>
        </ModeRow>
      </div>

      {/* Result */}
      <div className="flex min-h-0 flex-1 flex-col gap-[10px] px-[15px] pb-[15px]">
        <label className="text-sm text-slate-400">Result</label>
        <div
          className="flex-1 overflow-auto border-2 p-[10px] leading-6"
          style={{
            borderColor: "hsl(0, 0%, 10%)",
            wordBreak: "break-all",
          }}
        >
          {!hasInput ? (
            <span>&nbsp;</span>
          ) : (
            <DiffResultView parts={diffParts} lineMode={lineMode} />
          )}
        </div>
      </div>
    </div>
  );
}

function TextPanel({ label, value, onChange, fileRef, onFileLoad, onDrop }) {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-[5px]">
      <div className="flex items-center gap-[5px]">
        <label className="text-sm">{label}</label>
        <IconButton title="Open file" onClick={() => fileRef.current?.click()}>
          <FileUp strokeWidth={1.5} size={20} />
        </IconButton>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={onFileLoad}
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          setDragActive(false);
          onDrop(e);
        }}
        rows={10}
        className="flex-1 resize-none rounded-none border-2 p-[10px] text-base leading-[1.2] outline-none transition-colors"
        style={{
          fontFamily: "inherit",
          backgroundColor: "rgb(255 255 255 / 5%)",
          color: "white",
          borderColor: dragActive ? "#4ae44a" : "hsl(0, 0%, 10%)",
        }}
        spellCheck={false}
      />
      <div className="text-right text-sm text-slate-500">{value.length}</div>
    </div>
  );
}

function IconButton({ children, title, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="inline-flex cursor-pointer items-center justify-center border-none bg-transparent p-[5px] transition-all [&>svg]:text-[hsl(0,0%,60%)] [&>svg]:transition-all hover:bg-transparent [&:hover>svg]:text-white"
    >
      {children}
    </button>
  );
}

function ModeRow({ label, children }) {
  return (
    <div className="flex items-center gap-[5px]">
      <div className="text-sm text-slate-400">{label}</div>
      {children}
    </div>
  );
}

function ToggleButton({ children, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex cursor-pointer border-2 border-transparent bg-transparent px-[10px] py-[5px] text-sm transition-all"
      style={{
        fontFamily: "inherit",
        color: selected ? "white" : "hsl(0, 0%, 60%)",
        borderColor: selected ? "hsl(0, 0%, 5%)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function DiffResultView({ parts, lineMode }) {
  const lines = useMemo(() => splitIntoLines(parts), [parts]);

  const isIdentical = useMemo(
    () => parts.every((p) => !p.added && !p.removed),
    [parts],
  );

  const visibleLines = useMemo(() => {
    if (lineMode === "changed") {
      return lines.filter((line) => line.some((p) => p.added || p.removed));
    }
    return lines;
  }, [lines, lineMode]);

  if (isIdentical && parts.length > 0) {
    return (
      <div className="text-center select-none" style={{ color: "hsl(0,0%,60%)" }}>
        Text is identical!
      </div>
    );
  }

  return (
    <div>
      {visibleLines.map((line, lineIdx) => (
        <div key={lineIdx} className="whitespace-pre" style={{ textWrap: "wrap" }}>
          {line.length === 0 && <span>&nbsp;</span>}
          {line.map(({ value, added, removed }, partIdx) => {
            const key = `${lineIdx}-${partIdx}`;

            if (value === "\n") {
              if (added) return <Added key={key} asChar>{"\\n"}</Added>;
              if (removed) return <Removed key={key} asChar>{"\\n"}</Removed>;
              return <span key={key}> </span>;
            }

            if (added) return <Added key={key}>{value}</Added>;
            if (removed) return <Removed key={key}>{value}</Removed>;
            return <Unchanged key={key}>{value}</Unchanged>;
          })}
        </div>
      ))}
    </div>
  );
}

function Added({ children, asChar = false }) {
  const baseStyle = {
    backgroundColor: "#90ee908c",
    border: "2px solid #4ae44a",
    color: "white",
  };

  if (asChar) {
    return (
      <span style={{ ...baseStyle, border: 0, borderBottom: "2px solid #4ae44a", color: "rgb(255 255 255 / 32%)" }}>
        {children}
      </span>
    );
  }

  return <span style={baseStyle}>{children}</span>;
}

function Removed({ children, asChar = false }) {
  const baseStyle = {
    backgroundColor: "#f080808c",
    border: "2px solid lightcoral",
    color: "white",
  };

  if (asChar) {
    return (
      <span style={{ ...baseStyle, border: 0, borderBottom: "2px solid lightcoral", color: "rgb(255 255 255 / 32%)" }}>
        {children}
      </span>
    );
  }

  return <span style={baseStyle}>{children}</span>;
}

function Unchanged({ children }) {
  return <span className="whitespace-pre-wrap">{children}</span>;
}
