<template>
  <component
    :is="IconComp"
    v-if="IconComp && !isMarkup"
    :style="props.size != 24 ? { width: pxSize, height: pxSize } : ''"
    :class="['icon', 'tr-icon', $attrs.class]"
    v-bind="$attrs"
  />
  <span
    v-else-if="isMarkup"
    :class="['icon', 'tr-icon', $attrs.class]"
    :style="{ width: pxSize, height: pxSize }"
    v-bind="$attrs"
    v-html="IconComp"
  />
  <span
    v-else
    class="icon tr-icon--placeholder"
    :style="{ width: pxSize, height: pxSize }"
    aria-hidden="true"
  />
</template>

<script setup>
import { computed, inject } from "vue";

import { iconRegistryKey } from "../icon-registry.js";

/**
 * Renders one entry from the application's custom-icon registry (see
 * `iconRegistryKey` / `provideIconRegistry` in `../icon-registry.js`) — the
 * icon set with no Material Design Icons equivalent (LLM vendor logos,
 * model-kind icons in the reference kit this was ported from). Everything
 * else in a Buefy-based app is a plain `b-icon` with an MDI name and does
 * not go through this component.
 *
 * Unlike the kit-only predecessor this replaces, `Icon` does not reach into
 * any bundler-specific asset glob (`import.meta.glob("@/assets/...")`): the
 * registry is provided once by the consuming application (see this
 * package's README), so importing this component needs neither
 * `vite-svg-loader` nor a `@/assets` alias.
 *
 * Renders nothing but an `aria-hidden` placeholder box (reserving layout
 * space at the requested size) when `name` is not registered — the same
 * fallback the kit predecessor used for an unresolved icon name.
 *
 * Props: `name` (required, registry key), `size` (number in px, or any CSS
 * length string; default `24`).
 * Attrs: forwarded to the rendered icon (`class`, `aria-*`, `title`, ...).
 * Slots: none.
 */
const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 24,
  },
});

const registry = inject(iconRegistryKey, {});

const IconComp = computed(() => registry[props.name] ?? null);
const isMarkup = computed(() => typeof IconComp.value === "string");

const pxSize = computed(() => (typeof props.size === "number" ? `${props.size}px` : props.size));
</script>
