<template>
  <b-dropdown
    class="tr-mobile-filters"
    position="is-bottom-left"
    aria-role="menu"
  >
    <template #trigger>
      <b-button
        class="tr-mobile-filters__trigger"
        :class="{ 'is-active': active }"
        icon-left="filter-variant"
        :aria-label="triggerAriaLabel"
        :title="triggerTitle"
      />
    </template>

    <b-dropdown-item custom :focusable="false">
      <div class="tr-mobile-filters__content">
        <slot />
      </div>
    </b-dropdown-item>
  </b-dropdown>
</template>

<script setup>
/**
 * Below `Toolbar`'s own filter-pill breakpoint, the inline filters are
 * hidden by CSS; this trigger/panel is the only way to reach them, so
 * `Toolbar` renders the same filters slot content a second time through
 * here instead of wrapping to a second toolbar row.
 *
 * Props: `active` (Boolean — flags the trigger as "has active filters";
 * this component has no visibility into the slot content's own state, so
 * the caller computes it), `triggerAriaLabel`/`triggerTitle` (accessible
 * name and tooltip for the trigger button — override for a non-Russian
 * consumer).
 * Slot: default — the filters panel content.
 *
 * Requires Buefy (`b-dropdown`, `b-button`).
 */
defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  triggerAriaLabel: {
    type: String,
    default: "Открыть фильтры",
  },
  triggerTitle: {
    type: String,
    default: "Фильтры",
  },
});
</script>
