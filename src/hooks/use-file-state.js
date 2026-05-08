import { useState, useEffect, useRef, useCallback } from "react";
import { readTextFile, writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

const DEBOUNCE_MS = 500;

/**
 * Resolves the absolute path for a tool file, creating the directory if needed.
 * @param {string} toolSlug  e.g. "diff-viewer"
 * @param {string} filename  e.g. "version-a.txt"
 * @returns {Promise<string>}
 */
async function resolveToolPath(toolSlug, filename) {
  const base = await appDataDir();
  const dir = await join(base, toolSlug);
  await mkdir(dir, { recursive: true });
  return join(dir, filename);
}

/**
 * A useState replacement that persists its value to a file on disk.
 * Reads once on mount; writes are debounced to avoid hammering disk.
 *
 * @param {string} toolSlug   Tool folder name, e.g. "diff-viewer"
 * @param {string} filename   File name, e.g. "version-a.txt"
 * @param {string} defaultValue  Fallback when the file does not exist yet
 * @returns {[string, (value: string) => void, boolean]}  [value, setter, isLoaded]
 */
export function useFileState(toolSlug, filename, defaultValue) {
  const [value, setValue] = useState(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const debounceTimer = useRef(null);
  const pathRef = useRef(null);

  // Read file on mount
  useEffect(() => {
    let cancelled = false;

    resolveToolPath(toolSlug, filename)
      .then((path) => {
        pathRef.current = path;
        return readTextFile(path);
      })
      .then((text) => {
        if (!cancelled) {
          setValue(text);
          setIsLoaded(true);
        }
      })
      .catch(() => {
        // File doesn't exist yet — use the default value
        if (!cancelled) setIsLoaded(true);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSlug, filename]);

  const set = useCallback((newValue) => {
    setValue(newValue);

    // Debounce the disk write
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        const path = pathRef.current ?? await resolveToolPath(toolSlug, filename);
        pathRef.current = path;
        await writeTextFile(path, newValue);
      } catch (err) {
        console.error(`[useFileState] Failed to write ${toolSlug}/${filename}:`, err);
      }
    }, DEBOUNCE_MS);
  }, [toolSlug, filename]);

  return [value, set, isLoaded];
}
