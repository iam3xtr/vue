<template>
  <div
    class="tr-loader"
    :class="`tr-loader--${size}`"
    role="status"
    aria-live="polite"
    :aria-label="label"
  >
    <span class="tr-loader__mark" aria-hidden="true" v-html="mark" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import loaderMarkRaw from "@iam3xtr/ui/assets/loader-mono.svg?raw";
import loaderMarkStaticRaw from "@iam3xtr/ui/assets/loader-mono-static.svg?raw";

/**
 * Single shared loading indicator: three sizes (`inline` inside a
 * button/line, by text height; `section` centered inside a card/panel/list
 * area; `screen` full-viewport), theme-aware color via `currentColor` (the
 * inlined SVG mark inherits it — see `@iam3xtr/ui`'s theme), and a static
 * mark under `prefers-reduced-motion` (the animated mark's SMIL `<animate>`
 * is not covered by the `prefers-reduced-motion` media query, so a
 * matching static SVG with no `<animate>` elements is swapped in instead).
 *
 * The mark is imported as a raw SVG string (`?raw`, a plain Vite core
 * feature) and inlined via `v-html`, not as an SVG-as-component import —
 * this is what lets the package avoid a `vite-svg-loader` build dependency
 * while still inheriting `currentColor` and keeping the `<animate>`
 * elements interactive in the DOM.
 *
 * Props: `size` (`"inline" | "section" | "screen"`, default `"section"`),
 * `label` (accessible name announced via `aria-label`/`role="status"`,
 * default `"Загрузка"` — override for a non-Russian consumer). Slots: none.
 *
 * SSR-safe: `window.matchMedia` is read only inside `onMounted`, and the
 * listener it attaches is removed in `onBeforeUnmount`.
 */
defineProps({
  size: {
    type: String,
    default: "section",
    validator: (value) => ["inline", "section", "screen"].includes(value),
  },
  label: {
    type: String,
    default: "Загрузка",
  },
});

const prefersReducedMotion = ref(false);
let mediaQuery = null;

function handleChange(event) {
  prefersReducedMotion.value = event.matches;
}

onMounted(() => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  prefersReducedMotion.value = mediaQuery.matches;
  mediaQuery.addEventListener("change", handleChange);
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener("change", handleChange);
  mediaQuery = null;
});

const mark = computed(() => (prefersReducedMotion.value ? loaderMarkStaticRaw : loaderMarkRaw));
</script>
