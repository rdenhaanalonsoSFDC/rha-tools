import { useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import YAML from "yaml";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  Braces,
} from "lucide-react";
import { usePersistedState } from "../../hooks/use-persisted-state";

const SAMPLE_SPEC = `openapi: "3.0.3"
info:
  title: Sample API
  version: "1.0.0"
paths:
  /users:
    post:
      summary: Create a user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/User'
      responses:
        "201":
          description: User created
components:
  schemas:
    User:
      type: object
      required:
        - name
        - email
      properties:
        name:
          type: string
          minLength: 1
        email:
          type: string
          format: email
        age:
          type: integer
          minimum: 0
`;

const SAMPLE_PAYLOAD = `{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30
}`;

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 12 },
};

const monacoThemeConfig = {
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
};

export default function OpenApiValidator() {
  const [specYaml, setSpecYaml] = usePersistedState("openapi-spec", SAMPLE_SPEC);
  const [payload, setPayload] = usePersistedState("openapi-payload", SAMPLE_PAYLOAD);
  const [selectedSchema, setSelectedSchema] = usePersistedState("openapi-schema", "");
  const [strictMode, setStrictMode] = usePersistedState("openapi-strict", "false");
  const [specErrors, setSpecErrors] = useState([]);
  const [payloadErrors, setPayloadErrors] = useState([]);
  const [specValid, setSpecValid] = useState(null);
  const [payloadValid, setPayloadValid] = useState(null);
  const [availableSchemas, setAvailableSchemas] = useState([]);
  const [isValidating, setIsValidating] = useState(false);

  const handleEditorMount = (_editor, monaco) => {
    monaco.editor.defineTheme("rha-tools-dark", monacoThemeConfig);
    monaco.editor.setTheme("rha-tools-dark");
  };

  const validateSpec = useCallback(async () => {
    setIsValidating(true);
    setSpecErrors([]);
    setSpecValid(null);
    setAvailableSchemas([]);

    const doc = YAML.parseDocument(specYaml);

    if (doc.errors.length > 0) {
      setSpecErrors(doc.errors.map((e) => ({
        message: `YAML Syntax Error: ${e.message}`,
        line: e.linePos?.[0]?.line ?? null,
      })));
      setSpecValid(false);
      setIsValidating(false);
      return;
    }

    const parsed = doc.toJS();

    try {
      await SwaggerParser.validate(JSON.parse(JSON.stringify(parsed)));

      setSpecValid(true);
      setSpecErrors([]);

      const schemas = parsed?.components?.schemas;
      if (schemas) {
        const schemaNames = Object.keys(schemas);
        setAvailableSchemas(schemaNames);
        if (!schemaNames.includes(selectedSchema)) {
          setSelectedSchema("");
        }
      }
    } catch (error) {
      setSpecValid(false);
      const errors = extractValidationErrors(error).map((err) => ({
        ...err,
        line: err.line ?? resolveErrorLine(specYaml, doc, err.path),
      }));
      setSpecErrors(errors);
    } finally {
      setIsValidating(false);
    }
  }, [specYaml, selectedSchema]);

  const validatePayload = useCallback(async () => {
    if (!specValid) {
      setPayloadErrors([{
        message: "The OpenAPI spec must be valid before testing a payload. Click \"Validate Spec\" first.",
      }]);
      setPayloadValid(false);
      return;
    }

    if (!selectedSchema) {
      setPayloadErrors([{ message: "Select a schema from the dropdown before testing the payload." }]);
      setPayloadValid(false);
      return;
    }

    setPayloadErrors([]);
    setPayloadValid(null);

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (error) {
      const posMatch = error.message.match(/position\s+(\d+)/i);
      const line = posMatch ? offsetToLine(payload, Number(posMatch[1])) : null;
      setPayloadErrors([{ message: `Invalid JSON: ${error.message}`, line }]);
      setPayloadValid(false);
      return;
    }

    try {
      const parsed = YAML.parse(specYaml);
      const schemaObj = parsed?.components?.schemas?.[selectedSchema];

      if (!schemaObj) {
        setPayloadErrors([{ message: `Schema "${selectedSchema}" not found in spec.` }]);
        setPayloadValid(false);
        return;
      }

      let resolvedSchema = resolveRefs(schemaObj, parsed);
      if (strictMode === "true") {
        resolvedSchema = applyStrictMode(resolvedSchema);
      }

      const ajv = new Ajv({ allErrors: true, strict: false });
      addFormats(ajv);

      const validate = ajv.compile(resolvedSchema);
      const valid = validate(parsedPayload);

      if (valid) {
        setPayloadValid(true);
        setPayloadErrors([]);
      } else {
        setPayloadValid(false);
        setPayloadErrors(
          validate.errors.map((e) => ({
            message: formatDetailMessage(e),
            path: e.instancePath || "/",
            keyword: e.keyword,
            line: findJsonKeyLine(payload, e.instancePath),
          })),
        );
      }
    } catch (error) {
      setPayloadValid(false);
      setPayloadErrors([{ message: error.message }]);
    }
  }, [payload, specYaml, selectedSchema, specValid, strictMode]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <h2 className="text-lg font-semibold text-slate-100">OpenAPI Validator</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={validateSpec}
            disabled={isValidating}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            <FileCode className="h-3.5 w-3.5" />
            Validate Spec
          </button>

          <div className="mx-1 h-5 w-px bg-slate-700" />

          <select
            value={selectedSchema}
            onChange={(e) => setSelectedSchema(e.target.value)}
            disabled={availableSchemas.length === 0}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-emerald-500 disabled:opacity-40"
          >
            <option value="">
              {availableSchemas.length === 0
                ? "No schemas available"
                : "-- Select schema --"}
            </option>
            {availableSchemas.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400 select-none">
            <input
              type="checkbox"
              checked={strictMode === "true"}
              onChange={(e) => setStrictMode(String(e.target.checked))}
              className="accent-emerald-500"
            />
            Strict
          </label>
          <button
            onClick={validatePayload}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <Braces className="h-3.5 w-3.5" />
            Test Payload
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        {/* YAML Spec Editor */}
        <div className="flex min-h-0 flex-col border-r border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <span className="text-xs font-medium text-slate-500 uppercase">
              OpenAPI Spec (YAML)
            </span>
            <StatusBadge valid={specValid} />
          </div>
          <div className="min-h-0 flex-1">
            <Editor
              height="100%"
              language="yaml"
              value={specYaml}
              onChange={(value) => setSpecYaml(value ?? "")}
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
          <ErrorPanel errors={specErrors} title="Spec Validation" />
        </div>

        {/* JSON Payload Editor */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <span className="text-xs font-medium text-slate-500 uppercase">
              JSON Payload
            </span>
            <StatusBadge valid={payloadValid} />
          </div>
          <div className="min-h-0 flex-1">
            <Editor
              height="100%"
              language="json"
              value={payload}
              onChange={(value) => setPayload(value ?? "")}
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
          <ErrorPanel errors={payloadErrors} title="Payload Validation" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ valid }) {
  if (valid === null) return null;

  return valid ? (
    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Valid
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <XCircle className="h-3.5 w-3.5" />
      Invalid
    </span>
  );
}

function ErrorPanel({ errors, title }) {
  if (!errors.length) return null;

  return (
    <div className="max-h-40 overflow-y-auto border-t border-slate-800 bg-slate-900/50 p-3">
      <div className="space-y-1.5">
        {errors.map((error, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 rounded bg-red-500/5 px-2 py-1.5 text-xs"
          >
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
            <div>
              {error.line != null && (
                <span className="mr-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-indigo-400">
                  Ln {error.line}
                </span>
              )}
              {error.path && (
                <span className="mr-2 font-mono text-slate-500">{error.path}</span>
              )}
              <span className="text-red-300">{error.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Converts a character offset to a 1-based line number.
 */
function offsetToLine(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

/**
 * Uses the YAML document AST to resolve a dotted or JSON-pointer path to a line number.
 */
function resolveErrorLine(yamlSource, doc, pathStr) {
  if (!pathStr || !doc) return null;

  let segments;
  if (pathStr.startsWith("#/") || pathStr.startsWith("/")) {
    segments = pathStr
      .replace(/^#\//, "")
      .replace(/^\//, "")
      .split("/")
      .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
  } else {
    segments = pathStr.split(".");
  }

  if (!segments.length) return null;

  try {
    const node = doc.getIn(segments, true);
    if (node?.range) {
      return offsetToLine(yamlSource, node.range[0]);
    }
  } catch { /* path not found */ }

  return null;
}

/**
 * Best-effort line lookup for a JSON instancePath like "/name" in a JSON string.
 */
function findJsonKeyLine(jsonText, instancePath) {
  if (!instancePath || instancePath === "/") return null;
  const key = instancePath.split("/").filter(Boolean).pop();
  const lines = jsonText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`"${key}"`)) return i + 1;
  }
  return null;
}

/**
 * Tries to extract a JSON-pointer path from the start of an error message line.
 * e.g. "/paths/~1users/post  must have required property 'responses'"
 */
function extractPathFromMessage(text) {
  const match = text.match(/^(#?\/[^\s]+)\s+(.*)/);
  if (match) return { path: match[1], message: match[2] };
  return null;
}

/**
 * Enriches a raw AJV/SwaggerParser detail object into a readable message
 * that includes the relevant param context (which property, etc.).
 */
function formatDetailMessage(detail) {
  const base = detail.message || String(detail);
  const { keyword, params } = detail;
  if (!params) return base;

  if (keyword === "additionalProperties" && params.additionalProperty) {
    return `${base}: "${params.additionalProperty}"`;
  }
  if (keyword === "required" && params.missingProperty) {
    return `${base}: "${params.missingProperty}"`;
  }
  if (keyword === "enum" && params.allowedValues) {
    return `${base} [${params.allowedValues.join(", ")}]`;
  }
  if (keyword === "type" && params.type) {
    return `${base} (expected ${params.type})`;
  }
  return base;
}

/**
 * Extracts structured error messages from a SwaggerParser validation error.
 * Handles AJV-style details (instancePath + params), inner errors, and plain messages.
 */
function extractValidationErrors(error) {
  if (error.details?.length) {
    return error.details
      .filter((d) => d.keyword !== "oneOf")
      .map((d) => ({
        message: formatDetailMessage(d),
        path: d.instancePath || (Array.isArray(d.path) ? d.path.join(".") : d.path),
      }));
  }

  if (error.errors?.length) {
    return error.errors.map((e) => ({
      message: formatDetailMessage(e),
      path: e.instancePath || e.path?.join?.("."),
    }));
  }

  if (error.inner?.length) {
    return error.inner.map((e) => ({
      message: e.message || String(e),
    }));
  }

  const message = error.message || String(error);
  const lines = message.split("\n").filter(Boolean);

  if (lines.length > 1) {
    return lines.map((line) => {
      const trimmed = line.trim();
      const extracted = extractPathFromMessage(trimmed);
      if (extracted) return extracted;
      return { message: trimmed };
    });
  }

  const extracted = extractPathFromMessage(message);
  if (extracted) return [extracted];

  return [{ message }];
}

/**
 * Recursively adds `additionalProperties: false` to every object schema
 * so AJV rejects properties not defined in the spec.
 */
function applyStrictMode(schema) {
  if (!schema || typeof schema !== "object") return schema;

  const result = { ...schema };

  if (result.type === "object" && result.properties && result.additionalProperties === undefined) {
    result.additionalProperties = false;
  }

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([k, v]) => [k, applyStrictMode(v)]),
    );
  }
  if (result.items) {
    result.items = applyStrictMode(result.items);
  }
  if (result.allOf) {
    result.allOf = result.allOf.map(applyStrictMode);
  }
  if (result.oneOf) {
    result.oneOf = result.oneOf.map(applyStrictMode);
  }
  if (result.anyOf) {
    result.anyOf = result.anyOf.map(applyStrictMode);
  }

  return result;
}

/**
 * Resolves $ref references within a JSON Schema object against the full OpenAPI document.
 * Handles nested references for properties and items.
 */
function resolveRefs(schema, rootDoc) {
  if (!schema || typeof schema !== "object") return schema;

  if (schema.$ref) {
    const refPath = schema.$ref.replace("#/", "").split("/");
    let resolved = rootDoc;
    for (const segment of refPath) {
      resolved = resolved?.[segment];
    }
    return resolveRefs(resolved, rootDoc);
  }

  const result = { ...schema };

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, val]) => [
        key,
        resolveRefs(val, rootDoc),
      ]),
    );
  }

  if (result.items) {
    result.items = resolveRefs(result.items, rootDoc);
  }

  if (result.allOf) {
    result.allOf = result.allOf.map((s) => resolveRefs(s, rootDoc));
  }
  if (result.oneOf) {
    result.oneOf = result.oneOf.map((s) => resolveRefs(s, rootDoc));
  }
  if (result.anyOf) {
    result.anyOf = result.anyOf.map((s) => resolveRefs(s, rootDoc));
  }

  return result;
}
