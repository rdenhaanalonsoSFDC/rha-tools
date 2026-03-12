import { useState, useCallback } from "react";

const PREFIX = "rha-tools-";

/**
 * A useState replacement that persists its value to localStorage.
 * Keys are automatically prefixed with "rha-tools-" to avoid collisions.
 *
 * @param {string} key - Storage key (will be prefixed automatically)
 * @param {string} defaultValue - Fallback when nothing is stored yet
 * @returns {[string, (value: string) => void]}
 */
export function usePersistedState(key, defaultValue) {
  const storageKey = `${PREFIX}${key}`;

  const [value, setValue] = useState(
    () => localStorage.getItem(storageKey) ?? defaultValue,
  );

  const set = useCallback(
    (v) => {
      setValue(v);
      localStorage.setItem(storageKey, v);
    },
    [storageKey],
  );

  return [value, set];
}
