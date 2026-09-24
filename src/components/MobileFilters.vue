<template>
  <b-dropdown
    ref="dropdownRef"
    class="tr-mobile-filters"
    :position="positionRef"
    aria-role="menu"
    append-to-body
    @active-change="onActiveChange"
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
import { nextTick, ref, useTemplateRef } from "vue";

import { POSITIONS, useDropdownOverlay } from "../composables/useDropdownOverlay.js";

/**
 * Below `Toolbar`'s filter-pill breakpoint, the inline filters are hidden
 * by CSS; this trigger/panel is the only way to reach them, so `Toolbar`
 * renders the same filters slot content a second time through here
 * instead of wrapping to a second toolbar row.
 *
 * Props: `active` (Boolean — flags the trigger as "has active filters";
 * this component has no visibility into the slot content's own state,
 * so the caller computes it), `triggerAriaLabel`/`triggerTitle`
 * (accessible name and tooltip for the trigger button — override for a
 * non-Russian consumer).
 * Slot: default — the filters panel content.
 *
 * `append-to-body` is mandatory: the menu holds nested filters that may
 * otherwise clip against the toolbar's stacking context, and its z-index
 * must live independently of the toolbar. The overlay composable installs
 * the `tr-dropdown-overlay-portal` marker on the body wrapper Buefy
 * creates and lowers Buefy's `z-index: 99` to the `@iam3xtr/ui`
 * `--tr-z-dropdown` token via `!important`, so the menu cannot float
 * above `b-modal` / `b-sidebar`.
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

const dropdownRef = useTemplateRef("dropdownRef");
const triggerRef = ref(/** @type {HTMLElement|null} */ (null));
const wrapperRef = ref(/** @type {HTMLElement|null} */ (null));
const menuRef = ref(/** @type {HTMLElement|null} */ (null));
const isActive = ref(false);

const refreshRefs = () => {
  // Buefy exposes its rendered nodes on the component instance: the
  // `dropdown` root stays in the original mount position but loses its
  // `.dropdown-menu` child the moment `append-to-body` is set (Buefy
  // moves the menu into a body-side wrapper). We locate the menu through
  // Buefy's own `$refs.dropdownMenu` rather than scanning `document.body`
  // (which would race against a sibling `ToolbarDropdown` whose body wrapper
  // shares the same `.dropdown` / `.dropdown-menu` selectors).
  const dropdownInstance = dropdownRef.value;
  if (!dropdownInstance) return;
  const rootEl = dropdownInstance.$el;
  wrapperRef.value = rootEl?.classList?.contains("dropdown")
    ? rootEl
    : (rootEl?.querySelector?.(".dropdown") ?? rootEl);
  const trigger = rootEl?.querySelector?.(".dropdown-trigger");
  if (trigger) triggerRef.value = trigger;
  // Buefy's $refs.dropdownMenu points to the menu element Buefy itself
  // rendered; in portal mode this is the same node Buefy then moves into
  // the body wrapper, so the ref stays valid across the move.
  menuRef.value = dropdownInstance.$refs?.dropdownMenu
    ?? wrapperRef.value?.querySelector?.(".dropdown-menu")
    ?? null;
};

const positionRef = ref(/** @type {(typeof POSITIONS)[number]} */ ("is-bottom-left"));

useDropdownOverlay({
  triggerRef,
  menuRef,
  wrapperRef,
  activeRef: isActive,
  positionRef,
  appendToBody: true,
});

const onActiveChange = async (next) => {
  isActive.value = !!next;
  // Buefy's `isActive` watcher runs `updateAppendToBody` inside a single
  // `$nextTick` after its own watcher flush. We wait one tick to let
  // Buefy move the menu into the body wrapper and populate
  // `$refs.dropdownMenu`, then refresh our local refs. The composable's
  // own `apply()` waits another tick before measuring, so first-open is
  // measured against populated refs in every host scenario.
  await nextTick();
  refreshRefs();
};
</script>
