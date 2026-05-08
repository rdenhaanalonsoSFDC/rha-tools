import { useState, useEffect, useRef, useCallback } from "react";
import { readTextFile, writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

const DEBOUNCE_MS = 500;
const CONFIG_FILE = "config.json";

/**
 * Manages a single config.json per tool folder.
 * Returns [getKey, setKey, isLoaded] where getKey/setKey operate on individual
 * keys within the shared config object.
 *
 * Usage:
 *   const [getConfig, setConfig, isLoaded] = useConfigState("diff-viewer", { mode: "word" });
 *   const mode = getConfig("mode");
 *   setConfig("mode", "char");
 *
 * @param {string} toolSlug   Tool folder name, e.g. "diff-viewer"
 * @param {object} defaults   Default values for all config keys
 */
export function useConfigState(toolSlug, defaults) {
  const [config, setConfig] = useState(defaults);
  const [isLoaded, setIsLoaded] = useState(false);
  const debounceTimer = useRef(null);
  const pathRef = useRef(null);

  // Read config on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const base = await appDataDir();
      const dir = await join(base, toolSlug);
      await mkdir(dir, { recursive: true });
      const path = await join(dir, CONFIG_FILE);
      pathRef.current = path;

      try {
        const text = await readTextFile(path);
        const parsed = JSON.parse(text);
        if (!cancelled) setConfig({ ...defaults, ...parsed });
      } catch {
        // File doesn't exist yet — use defaults
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSlug]);

  const setKey = useCallback((key, value) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        try {
          const path = pathRef.current;
          if (path) await writeTextFile(path, JSON.stringify(next, null, 2));
        } catch (err) {
          console.error(`[useConfigState] Failed to write ${toolSlug}/config.json:`, err);
        }
      }, DEBOUNCE_MS);

      return next;
    });
  }, [toolSlug]);

  const getKey = useCallback((key) => config[key], [config]);

  return [getKey, setKey, isLoaded];
}
