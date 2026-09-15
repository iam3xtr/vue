<template>
  <header class="tr-page-header">
    <div class="page-header__main is-flex">
      <RouterLink
        v-if="back"
        :to="back?.to || './'"
        class="page-header__back"
        :title="back?.title"
      >
        <b-icon icon="chevron-left" />
      </RouterLink>
      <div>
        <h1 v-if="title" class="page-header__title">{{ title }}</h1>
        <div
          v-else-if="loading"
          class="page-header__skeleton--title tr-skeleton-block"
        ></div>

        <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
        <div
          v-else-if="loading"
          class="page-header__skeleton--subtitle tr-skeleton-block"
        ></div>
      </div>
    </div>
    <div v-if="$slots.default" class="buttons"><slot></slot></div>
  </header>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

/**
 * Page-level heading: title/subtitle, an optional back link, and an
 * actions row via the default slot. Lives in this package's `./navigation`
 * entry point (not core) because it always imports `RouterLink` — using it
 * requires an installed and mounted Vue Router, even when `back` is not
 * passed.
 *
 * There is no separate `loading` prop: the caller is expected to render
 * `<PageHeader>` before data arrives, simply omitting `title`/`subtitle` —
 * "neither is set" is itself the loading signal. Once `title` is present
 * while `subtitle` is legitimately absent (e.g. a list with no subtitle),
 * that is a normal state, not loading, and the subtitle skeleton is not
 * shown.
 *
 * Props: `title`, `subtitle` (both String, default `""`), `back`
 * (`{ to: RouteLocationRaw, title?: string }`, default `null`).
 * Slot: default — action buttons rendered on the right.
 *
 * Requires Buefy (`b-icon`, only rendered when `back` is set) and Vue
 * Router (`RouterLink`, always imported).
 */
const props = defineProps({
  title: {
    type: String,
    default: "",
  },
  subtitle: {
    type: String,
    default: "",
  },
  /** @type {import("vue").PropType<{ to: import("vue-router").RouteLocationRaw, title?: string }>} */
  back: {
    type: Object,
    default: null,
  },
});

const loading = computed(() => !props.title && !props.subtitle);
</script>
