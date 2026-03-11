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
  Play,
} from "lucide-react";

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
  const [specYaml, setSpecYaml] = useState(SAMPLE_SPEC);
  const [payload, setPayload] = useState(SAMPLE_PAYLOAD);
  const [specErrors, setSpecErrors] = useState([]);
  const [payloadErrors, setPayloadErrors] = useState([]);
  const [specValid, setSpecValid] = useState(null);
  const [payloadValid, setPayloadValid] = useState(null);
  const [selectedSchema, setSelectedSchema] = useState("");
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

    try {
      let parsed;
      try {
        parsed = YAML.parse(specYaml);
      } catch (yamlError) {
        setSpecErrors([{ message: `YAML Syntax Error: ${yamlError.message}` }]);
        setSpecValid(false);
        setIsValidating(false);
        return;
      }

      await SwaggerParser.validate(JSON.parse(JSON.stringify(parsed)));

      setSpecValid(true);
      setSpecErrors([]);

      const schemas = parsed?.components?.schemas;
      if (schemas) {
        const schemaNames = Object.keys(schemas);
        setAvailableSchemas(schemaNames);
        if (schemaNames.length > 0 && !selectedSchema) {
          setSelectedSchema(schemaNames[0]);
        }
      }
    } catch (error) {
      setSpecValid(false);
      const errors = error.details?.length
        ? error.details.map((d) => ({ message: d.message, path: d.path?.join(".") }))
        : [{ message: error.message }];
      setSpecErrors(errors);
    } finally {
      setIsValidating(false);
    }
  }, [specYaml, selectedSchema]);

  const validatePayload = useCallback(async () => {
    if (!selectedSchema) {
      setPayloadErrors([{ message: "Please validate the spec first and select a schema." }]);
      setPayloadValid(false);
      return;
    }

    setPayloadErrors([]);
    setPayloadValid(null);

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (error) {
      setPayloadErrors([{ message: `Invalid JSON: ${error.message}` }]);
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

      const resolvedSchema = resolveRefs(schemaObj, parsed);

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
            message: e.message,
            path: e.instancePath || "/",
            keyword: e.keyword,
          })),
        );
      }
    } catch (error) {
      setPayloadValid(false);
      setPayloadErrors([{ message: error.message }]);
    }
  }, [payload, specYaml, selectedSchema]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <h2 className="text-lg font-semibold text-slate-100">OpenAPI Validator</h2>
        <div className="flex items-center gap-3">
          {availableSchemas.length > 0 && (
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-indigo-500"
            >
              {availableSchemas.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={validateSpec}
            disabled={isValidating}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            <FileCode className="h-3.5 w-3.5" />
            Validate Spec
          </button>
          <button
            onClick={validatePayload}
            disabled={!specValid}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            <Braces className="h-3.5 w-3.5" />
            Test Payload
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        {/* YAML Spec Editor */}
        <div className="flex flex-col border-r border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <span className="text-xs font-medium text-slate-500 uppercase">
              OpenAPI Spec (YAML)
            </span>
            <StatusBadge valid={specValid} />
          </div>
          <div className="flex-1">
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
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <span className="text-xs font-medium text-slate-500 uppercase">
              JSON Payload
            </span>
            <StatusBadge valid={payloadValid} />
          </div>
          <div className="flex-1">
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
