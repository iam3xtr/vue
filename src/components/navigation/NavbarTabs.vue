<template>
  <nav class="tr-navbar-tabs" :aria-label="ariaLabel">
    <RouterLink
      v-for="item in items"
      :key="item.label"
      :to="item.to"
      class="tr-navbar-tabs__link"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink } from "vue-router";

/**
 * @typedef {Object} NavbarTabItem
 * @property {string} label
 * @property {import("vue-router").RouteLocationRaw} to
 */

/**
 * A row of route-link tabs, typically teleported into the app shell's
 * navbar via `NavbarMenu` (core entry point). Lives in this package's
 * `./navigation` entry point (not core) because it always imports and
 * renders `RouterLink`, requiring an installed and mounted Vue Router.
 *
 * Props: `items` (required — array of `{ label, to }`), `ariaLabel`
 * (default `"Навигационные вкладки"` — override for a non-Russian
 * consumer).
 * Slots: none.
 *
 * Requires Vue Router.
 */
defineProps({
  /** @type {import("vue").PropType<NavbarTabItem[]>} */
  items: {
    type: Array,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: "Навигационные вкладки",
  },
});
</script>
