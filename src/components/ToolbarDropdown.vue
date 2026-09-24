<template>
  <b-dropdown
    :key="appendToBody ? 'portal' : 'inline'"
    ref="dropdownRef"
    v-model="model"
    class="tr-dropdown tr-toolbar-dropdown"
    :position="positionRef"
    :append-to-body="appendToBody"
    aria-role="list"
    expanded
    @active-change="onActiveChange"
  >
    <template #trigger>
      <button
        ref="triggerRef"
        type="button"
        class="button tr-toolbar-dropdown__trigger"
        :aria-label="ariaLabel ?? allLabel"
      >
        <span class="tr-toolbar-dropdown__label">{{ selectedLabel }}</span>
        <b-icon icon="chevron-down" size="is-small" />
      </button>
    </template>

    <b-dropdown-item
      v-for="option in normalizedOptions"
      :key="option.value"
      :value="option.value"
      aria-role="listitem"
    >
      {{ option.label }}
    </b-dropdown-item>

    <b-dropdown-item separator />

    <b-dropdown-item value="" aria-role="listitem">
      {{ allLabel }}
    </b-dropdown-item>
  </b-dropdown>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, useTemplateRef } from "vue";

import {
  POSITIONS,
  resolveDropdownPlacement,
  useDropdownOverlay,
} from "../composables/useDropdownOverlay.js";

/**
 * @typedef {Object} ToolbarDropdownOption
 * @property {string} value
 * @property {string} label
 */

/**
 * A single-select `b-dropdown` filter with a trailing "show all" option,
 * used in `Toolbar`'s `filters` slot.
 *
 * Props: `options` (required — array of `{ value, label }` or plain
 * strings, in which case the string is used as both), `allLabel` (required
 * — text of the trailing reset option, and the trigger's fallback label
 * when nothing is selected), `ariaLabel` (defaults to `allLabel`).
 * `v-model` (required): the selected `value`, or `""` for "all".
 *
 * Wires the shared `useDropdownOverlay` composable so the open menu
 * overlays following content and flips upward when there is no room below
 * the trigger. The composable drives the `b-dropdown`'s `position` prop
 * through a local ref; Buefy reactively re-renders the wrapper class on
 * every flip. The menu renders inline unless an ancestor clips overflow,
 * in which case it moves to a body portal (`append-to-body`); inside a
 * modal, drawer or another dropdown menu it always stays inline to keep
 * that stacking context (see `resolveDropdownPlacement`).
 *
 * Requires Buefy (`b-dropdown`, `b-dropdown-item`, `b-icon`).
 */
const props = defineProps({
  /** @type {import("vue").PropType<(string | ToolbarDropdownOption)[]>} */
  options: {
    type: Array,
    required: true,
  },
  allLabel: {
    type: String,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: undefined,
  },
});

const model = defineModel({ required: true });

const normalizedOptions = computed(
  () => props.options.map((option) => (
    typeof option === "string"
      ? { value: option, label: option }
      : option
  )),
);

const selectedLabel = computed(() => {
  const selected = normalizedOptions.value.find(
    (option) => option.value === model.value,
  );

  return selected ? selected.label : props.allLabel;
});

// --- Auto-flip wiring ------------------------------------------------
//
// `b-dropdown` does not expose its `trigger` / `dropdownMenu` / `dropdown`
// refs publicly (they are part of its private render output), so we locate
// them through the DOM after the wrapper mounts and again after each
// `active-change` (Buefy toggles the `.dropdown-menu` with `v-show` and
// may recreate nodes between renders). The composable consumes element refs
// and handles its own listener + marker cleanup on close and unmount.

const dropdownRef = useTemplateRef("dropdownRef");
const triggerRef = useTemplateRef("triggerRef");
const wrapperRef = ref(/** @type {HTMLElement|null} */ (null));
const menuRef = ref(/** @type {HTMLElement|null} */ (null));
const isActive = ref(false);

const refreshRefs = () => {
  // The Buefy component instance is the same Vue proxy across renders; the
  // `$el` of a `b-dropdown` is the inner `.dropdown` root. The trigger and
  // menu live inside it for inline mode.
  const dropdownEl = dropdownRef.value?.$el ?? dropdownRef.value;
  if (!dropdownEl) return;
  const rootEl = dropdownEl.classList?.contains("dropdown")
    ? dropdownEl
    : (dropdownEl.querySelector?.(".dropdown") ?? dropdownEl);
  // In portal mode Buefy moves `$refs.dropdownMenu` into a body-side
  // `.dropdown` wrapper; the marker belongs on that wrapper.
  const menu = dropdownRef.value?.$refs?.dropdownMenu
    ?? rootEl?.querySelector?.(".dropdown-menu")
    ?? null;
  menuRef.value = menu;
  wrapperRef.value = menu?.closest?.(".dropdown") ?? rootEl;
  const trigger = rootEl?.querySelector?.(".dropdown-trigger");
  if (trigger) triggerRef.value = trigger;
};

const positionRef = ref(/** @type {(typeof POSITIONS)[number]} */ ("is-bottom-left"));

// Buefy creates its body wrapper only in `mounted()`, so the placement is
// resolved once the inline root is in the document; switching it remounts
// `b-dropdown` through its `key`.
const appendToBody = ref(false);
onMounted(() => {
  const rootEl = dropdownRef.value?.$el ?? null;
  appendToBody.value = resolveDropdownPlacement(rootEl) === "portal";
});

useDropdownOverlay({
  triggerRef,
  menuRef,
  wrapperRef,
  activeRef: isActive,
  positionRef,
  appendToBody,
});

const onActiveChange = async (next) => {
  isActive.value = !!next;
  // Re-locate the trigger and menu AFTER Buefy has flipped
  // `isActive` and run its own `nextTick`-deferred DOM updates, so the
  // first open does not race the composable's measurement.
  await nextTick();
  refreshRefs();
  // The composable waits two ticks internally; nudging it once more makes
  // sure its first apply() sees populated refs even when the host of the
  // dropdown is itself a child of another deferred mount.
  if (next) await nextTick();
};
</script>
