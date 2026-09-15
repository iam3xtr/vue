import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// No `@/...` alias and no `vite-svg-loader` plugin here on purpose — this
// package's whole point is not to require either from its own build (see
// README "SSR and bundler contract"). `Loader.vue`'s `?raw` SVG imports are
// handled by Vite core, and `Icon.vue` resolves icons from an injected
// registry rather than importing any asset itself.
export default defineConfig({
  plugins: [vue()],
  server: {
    fs: {
      // `@iam3xtr/ui` is a local `file:../ui` devDependency (a real sibling
      // submodule checkout, not published from the registry): allow Vite to
      // serve its assets via `?raw` from outside this package's own root.
      allow: [fileURLToPath(new URL("..", import.meta.url))],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
  },
});
