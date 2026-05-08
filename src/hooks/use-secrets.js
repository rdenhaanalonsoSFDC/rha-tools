import { useContext } from "react";
import { SecretsContext } from "../context/secrets-context";

export function useSecrets() {
  const ctx = useContext(SecretsContext);
  if (!ctx) throw new Error("useSecrets must be used within SecretsProvider");
  return ctx;
}
