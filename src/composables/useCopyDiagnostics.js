import { watchEffect } from "vue";

/** Internal development-only diagnostic; never supplies runtime copy.
 * Getters return consumer-owned text, or true when a name is not needed.
 */
export function useCopyDiagnostics(component, names) {
  if (!import.meta.env?.DEV) return;
  const warned = new Set();
  watchEffect(() => {
    for (const [name, read] of Object.entries(names)) {
      const value = read();
      const valid = value === true || (typeof value === "string" && value.trim().length > 0);
      if (valid || warned.has(name)) continue;
      warned.add(name);
      console.warn(`${component}: supply localized ${name}; the package provides no language fallback.`);
    }
  });
}
