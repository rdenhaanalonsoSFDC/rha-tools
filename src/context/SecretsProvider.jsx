import { useState, useEffect, useRef, useCallback } from "react";
import { SecretsContext } from "./secrets-context";
import { getOrCreateDeviceKey, deriveKey, loadSecrets, saveSecrets } from "../settings/secrets-store";

export function SecretsProvider({ children }) {
  const [secretsMap, setSecretsMap] = useState(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const cryptoKeyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const deviceKey = await getOrCreateDeviceKey();
        const cryptoKey = await deriveKey(deviceKey);
        const map = await loadSecrets(cryptoKey);
        if (!cancelled) {
          cryptoKeyRef.current = cryptoKey;
          setSecretsMap(map);
          setIsLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message ?? String(err));
          setIsLoaded(true);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const getSecret = useCallback((name) => secretsMap.get(name), [secretsMap]);

  const allSecretNames = Array.from(secretsMap.keys());

  const setSecret = useCallback(async (name, value) => {
    const next = new Map(secretsMap);
    next.set(name, value);
    await saveSecrets(cryptoKeyRef.current, next);
    setSecretsMap(next);
  }, [secretsMap]);

  const deleteSecret = useCallback(async (name) => {
    const next = new Map(secretsMap);
    next.delete(name);
    await saveSecrets(cryptoKeyRef.current, next);
    setSecretsMap(next);
  }, [secretsMap]);

  return (
    <SecretsContext.Provider value={{ getSecret, allSecretNames, setSecret, deleteSecret, isLoaded, error }}>
      {children}
    </SecretsContext.Provider>
  );
}
