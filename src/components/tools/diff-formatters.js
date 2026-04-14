import { js_beautify, html_beautify, css_beautify } from "js-beautify";
import { format as sqlFormat } from "sql-formatter";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";

export const CONTENT_TYPES = [
  { value: "", label: "— type —" },
  { value: "json", label: "JSON" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "yaml", label: "YAML" },
  { value: "bash", label: "Bash" },
  { value: "ampscript", label: "AMPScript" },
  { value: "sql-server", label: "SQL Server" },
  { value: "sql-data360", label: "SQL Data 360" },
  { value: "apex", label: "Apex" },
];

function deepSortKeys(value) {
  if (Array.isArray(value)) return value.map(deepSortKeys);
  if (value !== null && typeof value === "object") {
    const sorted = {};
    Object.keys(value)
      .sort()
      .forEach((k) => {
        sorted[k] = deepSortKeys(value[k]);
      });
    return sorted;
  }
  return value;
}

const JS_OPTS = {
  indent_size: 2,
  indent_char: " ",
  preserve_newlines: true,
  max_preserve_newlines: 2,
  space_after_anon_function: true,
  brace_style: "collapse",
  end_with_newline: false,
};

const HTML_OPTS = {
  indent_size: 2,
  indent_char: " ",
  indent_inner_html: true,
  preserve_newlines: true,
  max_preserve_newlines: 2,
  wrap_line_length: 120,
  end_with_newline: false,
};

const CSS_OPTS = {
  indent_size: 2,
  indent_char: " ",
  end_with_newline: false,
};

function formatBash(text) {
  const lines = text.split("\n");
  const result = [];
  let indent = 0;
  const TAB = "  ";
  const dedentBefore = /^\s*(fi|done|esac|else|elif\b|\}|\))\s*/;
  const indentAfter = /\b(then|do|else)\s*$|\belse\s*$|{\s*$|\(\s*$/;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      result.push("");
      continue;
    }
    if (dedentBefore.test(trimmed) && indent > 0) indent--;
    result.push(TAB.repeat(indent) + trimmed);
    if (indentAfter.test(trimmed)) indent++;
  }

  return result.join("\n");
}

function formatAmpScript(text) {
  const lines = text.split("\n");
  const result = [];
  let indent = 0;
  const TAB = "  ";

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      result.push("");
      continue;
    }
    const upper = trimmed.toUpperCase();

    const isDedent =
      upper === "]%%" ||
      upper.startsWith("ENDIF") ||
      upper.startsWith("NEXT ") ||
      upper.startsWith("NEXT\t") ||
      upper === "NEXT" ||
      upper.startsWith("ELSE") ||
      upper.startsWith("ELSEIF");

    if (isDedent && indent > 0) indent--;

    result.push(TAB.repeat(indent) + trimmed);

    const isIndent =
      upper === "%%[" ||
      upper.endsWith("THEN") ||
      upper.endsWith("DO") ||
      (upper.startsWith("ELSE") && !upper.startsWith("ELSEIF"));

    if (upper.startsWith("ELSEIF") && upper.endsWith("THEN")) {
      indent++;
    } else if (isIndent) {
      indent++;
    }
  }

  return result.join("\n");
}

/**
 * Format content based on the selected content type.
 * Returns the original text unchanged if formatting fails.
 * @param {string} text
 * @param {string} type - one of the CONTENT_TYPES value keys
 * @returns {string}
 */
export function formatContent(text, type) {
  if (!text.trim()) return text;

  try {
    switch (type) {
      case "json": {
        const parsed = JSON.parse(text);
        return JSON.stringify(deepSortKeys(parsed), null, 2);
      }
      case "javascript":
        return js_beautify(text, JS_OPTS);
      case "typescript":
        return js_beautify(text, { ...JS_OPTS, e4x: false });
      case "html":
        return html_beautify(text, HTML_OPTS);
      case "css":
        return css_beautify(text, CSS_OPTS);
      case "yaml": {
        const doc = yamlParse(text);
        return yamlStringify(doc, { indent: 2, lineWidth: 120 }).trimEnd();
      }
      case "bash":
        return formatBash(text);
      case "ampscript":
        return formatAmpScript(text);
      case "sql-server":
        return sqlFormat(text, { language: "transactsql", tabWidth: 2, useTabs: false });
      case "sql-data360":
        return sqlFormat(text, { language: "sql", tabWidth: 2, useTabs: false });
      case "apex":
        return js_beautify(text, { ...JS_OPTS, e4x: false });
      default:
        return text;
    }
  } catch {
    return text;
  }
}

/**
 * Heuristic auto-detection of content type from text.
 * Returns the matching CONTENT_TYPES value key, or "" if uncertain.
 * @param {string} text
 * @returns {string}
 */
export function detectContentType(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (/%%\[/.test(trimmed) || /\bSET\s+@\w/i.test(trimmed)) return "ampscript";

  if (/^[\[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) return "json";
    } catch {
      /* not JSON */
    }
  }

  if (/^<!DOCTYPE\s/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return "html";
  if (
    /<\/?(div|span|p|h[1-6]|body|head|table|form|input|button|a|img|ul|ol|li|section|article|header|footer|nav|main)[\s>/]/i.test(
      trimmed,
    ) &&
    (trimmed.match(/</g) || []).length > 2
  )
    return "html";

  if (/^#!\s*\/bin\/(bash|sh|zsh)/.test(trimmed) || /^#!\s*\/usr\/bin\/env\s+(bash|sh|zsh)/.test(trimmed))
    return "bash";

  if (
    /(public|private|global)\s+(class|interface|enum|abstract|virtual)\s/i.test(trimmed) ||
    /System\.(debug|assert|assertEquals)/i.test(trimmed) ||
    /@isTest/i.test(trimmed) ||
    /\b(trigger|Trigger)\s+\w+\s+on\s+\w+/.test(trimmed)
  )
    return "apex";

  if (/^(@media|@import|@font-face|@keyframes|@charset)/m.test(trimmed)) return "css";
  if (
    /^[.#]?[a-zA-Z][\w-]*\s*\{/m.test(trimmed) &&
    !/\b(function|const|let|var|import|export|class)\b/.test(trimmed)
  )
    return "css";

  if (
    /\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|UPDATE\s+\w+\s+SET)\b/is.test(
      trimmed,
    )
  ) {
    if (/\b(DECLARE\s+@|BEGIN\s+TRY|EXEC\s|NVARCHAR|@@ROWCOUNT)\b/i.test(trimmed)) return "sql-server";
    return "sql-server";
  }

  if (/^---\s*$/m.test(trimmed)) return "yaml";
  if (/^[a-zA-Z_][\w.-]*:\s/m.test(trimmed) && !/[{;()]/.test(trimmed.split("\n")[0])) return "yaml";

  if (
    /\b(interface|type|enum)\s+[A-Z]\w*/.test(trimmed) ||
    /:\s*(string|number|boolean|any|void|never|unknown)\b/.test(trimmed) ||
    /<[A-Z]\w*>/.test(trimmed)
  )
    return "typescript";

  if (/\b(function|const|let|var|import|export|class|async|await|require)\b/.test(trimmed)) return "javascript";

  return "";
}
