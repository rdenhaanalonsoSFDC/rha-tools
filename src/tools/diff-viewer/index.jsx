import { useState, useMemo, useRef, useCallback } from "react";
import { diffWords, diffChars, diffLines } from "diff";
import { ArrowRightLeft, Trash2, FileUp, Wand2 } from "lucide-react";
import { useFileState } from "../../hooks/use-file-state";
import { useConfigState } from "../../hooks/use-config-state";
import { CONTENT_TYPES, formatContent, detectContentType } from "./diff-formatters";

const DIFF_FNS = {
  word: (a, b) => diffWords(a, b, { ignoreWhitespace: false }),
  char: diffChars,
  line: diffLines,
};

/**
 * Splits a flat diff-parts array into lines (arrays of parts per visual line),
 * matching the difftext.com X0 algorithm.
 */
function splitIntoLines(parts) {
  const lines = [];
  let currentLine = [];

  parts.forEach((part) => {
    const segments = part.value.split("\n");
    segments.forEach((segment, idx) => {
      if (idx > 0) {
        lines.push(currentLine);
        currentLine = [];
      }
      if (segment !== "") {
        currentLine.push({ ...part, value: segment });
      }
    });
  });

  if (currentLine.length) lines.push(currentLine);
  return lines;
}

const SLUG = "diff-viewer";
const CONFIG_DEFAULTS = { mode: "word", lineMode: "all", typeA: "", typeB: "", nameA: "", nameB: "" };

export default function DiffViewer() {
  const [textA, setTextA] = useFileState(SLUG, "version-a.txt", "");
  const [textB, setTextB] = useFileState(SLUG, "version-b.txt", "");
  const [getConfig, setConfig] = useConfigState(SLUG, CONFIG_DEFAULTS);

  const diffMode = getConfig("mode");
  const lineMode = getConfig("lineMode");
  const contentTypeA = getConfig("typeA");
  const contentTypeB = getConfig("typeB");
  const nameA = getConfig("nameA");
  const nameB = getConfig("nameB");

  const setDiffMode = useCallback((v) => setConfig("mode", v), [setConfig]);
  const setLineMode = useCallback((v) => setConfig("lineMode", v), [setConfig]);
  const setContentTypeA = useCallback((v) => setConfig("typeA", v), [setConfig]);
  const setContentTypeB = useCallback((v) => setConfig("typeB", v), [setConfig]);
  const setNameA = useCallback((v) => setConfig("nameA", v), [setConfig]);
  const setNameB = useCallback((v) => setConfig("nameB", v), [setConfig]);

  const fileRefA = useRef(null);
  const fileRefB = useRef(null);

  const autoDetectAndSet = useCallback(
    (typeSetter) => (text) => {
      const detected = detectContentType(text);
      if (detected) typeSetter(detected);
    },
    [],
  );

  const handleFileLoad = useCallback(
    (textSetter, typeSetter, nameSetter) => (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        textSetter(text);
        const detected = detectContentType(text);
        if (detected) typeSetter(detected);
        nameSetter(file.name);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [],
  );

  const handleDrop = useCallback(
    (textSetter, typeSetter, nameSetter) => (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        textSetter(text);
        const detected = detectContentType(text);
        if (detected) typeSetter(detected);
        nameSetter(file.name);
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleSwap = useCallback(() => {
    const tmpText = textA;
    const tmpType = contentTypeA;
    const tmpName = nameA;
    setTextA(textB);
    setContentTypeA(contentTypeB);
    setNameA(nameB);
    setTextB(tmpText);
    setContentTypeB(tmpType);
    setNameB(tmpName);
  }, [textA, textB, contentTypeA, contentTypeB, nameA, nameB, setTextA, setTextB, setContentTypeA, setContentTypeB, setNameA, setNameB]);

  const handleClear = useCallback(() => {
    setTextA("");
    setTextB("");
    setContentTypeA("");
    setContentTypeB("");
    setNameA("");
    setNameB("");
  }, [setTextA, setTextB, setContentTypeA, setContentTypeB, setNameA, setNameB]);

  const handleFormatA = useCallback(() => {
    if (!contentTypeA || !textA.trim()) return;
    setTextA(formatContent(textA, contentTypeA));
  }, [textA, contentTypeA, setTextA]);

  const handleFormatB = useCallback(() => {
    if (!contentTypeB || !textB.trim()) return;
    setTextB(formatContent(textB, contentTypeB));
  }, [textB, contentTypeB, setTextB]);

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
          onFileLoad={handleFileLoad(setTextA, setContentTypeA, setNameA)}
          onDrop={handleDrop(setTextA, setContentTypeA, setNameA)}
          contentType={contentTypeA}
          onContentTypeChange={setContentTypeA}
          onFormat={handleFormatA}
          onAutoDetect={autoDetectAndSet(setContentTypeA)}
          name={nameA}
          onNameChange={setNameA}
        />

        {/* Icon Pane */}
        <div className="mt-[35px] mb-[23px] flex flex-col items-center gap-[5px]">
          <IconButton title="Swap inputs" onClick={handleSwap}>
            <ArrowRightLeft strokeWidth={1.5} size={24} />
          </IconButton>
          <IconButton title="Clear text" onClick={handleClear}>
            <Trash2 strokeWidth={1.5} size={24} />
          </IconButton>
        </div>

        <TextPanel
          label="Version B"
          value={textB}
          onChange={setTextB}
          fileRef={fileRefB}
          onFileLoad={handleFileLoad(setTextB, setContentTypeB, setNameB)}
          onDrop={handleDrop(setTextB, setContentTypeB, setNameB)}
          contentType={contentTypeB}
          onContentTypeChange={setContentTypeB}
          onFormat={handleFormatB}
          onAutoDetect={autoDetectAndSet(setContentTypeB)}
          name={nameB}
          onNameChange={setNameB}
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

function TextPanel({ label, value, onChange, fileRef, onFileLoad, onDrop, contentType, onContentTypeChange, onFormat, onAutoDetect, name, onNameChange }) {
  const [dragActive, setDragActive] = useState(false);
  const isPasting = useRef(false);

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
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="label…"
          className="h-[26px] min-w-0 flex-1 border border-[hsl(0,0%,20%)] bg-transparent px-2 text-xs text-[hsl(0,0%,60%)] outline-none placeholder:text-[hsl(0,0%,30%)] transition-colors hover:text-white focus:border-[hsl(0,0%,40%)] focus:text-white"
          style={{ fontFamily: "inherit" }}
          spellCheck={false}
        />
        <select
          value={contentType}
          onChange={(e) => onContentTypeChange(e.target.value)}
          className="ml-auto h-[26px] cursor-pointer border border-[hsl(0,0%,20%)] bg-transparent px-1 text-xs text-[hsl(0,0%,60%)] outline-none transition-colors hover:text-white focus:border-[hsl(0,0%,40%)]"
          style={{ fontFamily: "inherit" }}
        >
          {CONTENT_TYPES.map(({ value: v, label: l }) => (
            <option key={v} value={v} style={{ backgroundColor: "#1a1a1a" }}>
              {l}
            </option>
          ))}
        </select>
        <IconButton title="Format / Beautify" onClick={onFormat}>
          <Wand2 strokeWidth={1.5} size={20} style={{ opacity: contentType ? 1 : 0.3 }} />
        </IconButton>
      </div>
      <textarea
        value={value}
        onPaste={() => {
          isPasting.current = true;
        }}
        onChange={(e) => {
          const newValue = e.target.value;
          onChange(newValue);
          if (isPasting.current) {
            isPasting.current = false;
            onAutoDetect?.(newValue);
          }
        }}
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
