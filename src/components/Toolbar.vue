<template>
  <div class="tr-page-toolbar">
    <ToolbarSearch
      v-if="search !== undefined"
      v-model="query"
      class="tr-page-toolbar__search"
      :placeholder="searchPlaceholder"
      :aria-label="searchAriaLabel"
      @shortcut="emit('shortcut')"
    />

    <div v-if="$slots.filters" class="tr-action-group tr-page-toolbar__filters">
      <slot name="filters" />
    </div>

    <!-- Below the .tr-page-toolbar__filter breakpoint (see @iam3xtr/ui's
         theme) the inline filter pills above are hidden by CSS; this
         trigger/panel is the only way to reach them, so the same filters
         slot is rendered a second time here instead of wrapping to a
         second toolbar row. -->
    <MobileFilters v-if="$slots.filters" :active="filtersActive">
      <slot name="filters" />
    </MobileFilters>

    <div v-if="$slots.actions || $slots.default" class="tr-action-group">
      <slot name="actions">
        <slot />
      </slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

import MobileFilters from "./MobileFilters.vue";
import ToolbarSearch from "./ToolbarSearch.vue";

/**
 * A page/section-level toolbar: an optional search field
 * (`ToolbarSearch`), a `filters` slot (rendered both inline and, below the
 * responsive breakpoint, inside a `MobileFilters` trigger/panel), and an
 * `actions`/default slot for buttons.
 *
 * Props: `search` (String — presence, not truthiness, gates the search
 * field: pass `undefined`/omit to hide it entirely, or `""` to show it
 * empty), `searchPlaceholder`, `searchAriaLabel`, `filtersActive` (Boolean
 * — this component has no visibility into the `filters` slot's own state,
 * so the caller computes whether to flag the mobile trigger as active).
 * `v-model:search` (via `update:search`) drives the search field.
 * Emits: `shortcut` (re-emitted from the internal `ToolbarSearch`),
 * `update:search`.
 * Slots: `filters`, `actions` (falls back to the default slot when
 * `actions` is not provided — either name works for a simple button row),
 * default.
 *
 * Requires Buefy transitively (`ToolbarSearch`'s `b-input`,
 * `MobileFilters`'s `b-dropdown`/`b-button`) when `search` or `filters` are
 * used.
 */
const props = defineProps({
  search: {
    type: String,
    default: undefined,
  },
  searchPlaceholder: {
    type: String,
    default: "",
  },
  searchAriaLabel: {
    type: String,
    default: undefined,
  },
  filtersActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:search", "shortcut"]);

// ToolbarSearch's own v-model (defineModel) needs a real writable ref —
// proxy it onto the search prop / update:search event so v-model:search on
// <Toolbar> drives the caller's own filter state.
const query = computed({
  get: () => props.search ?? "",
  set: (value) => emit("update:search", value),
});
</script>
