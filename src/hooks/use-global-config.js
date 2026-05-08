import { useConfigState } from "./use-config-state";

const GLOBAL_DEFAULTS = {};

export function useGlobalConfig() {
  return useConfigState("global", GLOBAL_DEFAULTS);
}
