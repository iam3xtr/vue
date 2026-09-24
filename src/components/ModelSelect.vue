<template>
  <b-dropdown
    ref="dropdownRef"
    :key="appendToBody ? 'portal' : 'inline'"
    class="tr-model-select"
    :class="{ 'tr-model-select--open': isOpen }"
    :position="positionRef"
    :append-to-body="appendToBody"
    @active-change="onActiveChange"
  >
    <template #trigger>
      <b-button
        ref="triggerRef"
        class="tr-model-select__trigger"
        :class="{ 'is-danger': invalid }"
        icon-right="chevron-down"
        :aria-invalid="invalid ? 'true' : undefined"
        :id="inputId || undefined"
        :aria-label="triggerAriaLabel"
        :aria-expanded="isOpen ? 'true' : 'false'"
        :aria-controls="popupId"
        :title="canonicalDisplay || triggerTitle"
        :disabled="disabled"
        @keydown.down.prevent="openPicker"
      >
        <span class="tr-model-select__trigger-value">
          {{ canonicalDisplay || triggerPlaceholder }}
        </span>
      </b-button>
    </template>

    <b-dropdown-item
      v-show="isOpen"
      custom
      :focusable="false"
      class="tr-model-select__item"
    >
      <div
        :id="popupId"
        class="tr-model-select__popup"
        @focusout="onFocusOut"
      >
        <b-autocomplete
          ref="autocompleteRef"
          v-model="searchQuery"
          :data="visibleOptions"
          field="name"
          group-field="group"
          open-on-focus
          dropdown-position="bottom"
          :placeholder="searchPlaceholder"
          :aria-label="searchAriaLabel"
          @select="onSelect"
        >
          <template #default="{ option }">
            <span
              class="tr-model-select__option"
              :class="{ 'tr-model-select__option--selected': isCatalogSelection(option) }"
              :aria-current="isCatalogSelection(option) ? 'true' : undefined"
            >
              <icon
                :name="providerIconName(option)"
                aria-hidden="true"
              />
              <span class="tr-model-select__option-name">{{ option.name }}</span>
              <span
                v-if="isCatalogSelection(option)"
                class="tr-model-select__option-marker"
                aria-hidden="true"
              >
                ✓
              </span>
            </span>
          </template>

          <template #empty>
            <p class="tr-model-select__empty">{{ emptyLabel }}</p>
          </template>
        </b-autocomplete>
      </div>
    </b-dropdown-item>
  </b-dropdown>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";

import {
  POSITIONS,
  resolveDropdownPlacement,
  useDropdownOverlay,
} from "../composables/useDropdownOverlay.js";

/**
 * Public model catalog picker.
 *
 * The closed trigger always displays the canonical selection (looked up
 * by `v-model:modelId` against `models`). Opening shows a single popup
 * built on one outer `b-dropdown`; the first row is the search field
 * rendered through Buefy's `b-autocomplete`. The whole popup is moved
 * and flipped by the shared `useDropdownOverlay` composable, so the
 * search input and the results stay in the same DOM popup —
 * `b-autocomplete` does not create a second body portal and never picks
 * its own direction. Buefy's keyboard/focus/selection/close behaviour,
 * scroll and resize tracking, and modal/drawer layering remain the
 * contract; the component does not add its own outside-click handler
 * and only enhances focus management inside its own popup.
 *
 * This stage (2.1) ships the `mode === "model"` contract. Stage 2.2
 * extends the same component to also accept `mode: "byok"` and
 * `mode: "both"`, with the additional `v-model:use-own-api-key`,
 * `v-model:byok-model-id` and `v-model:provider-model-id` links, a
 * controlled `useOwnApiKey` switch visible only in `"both"`, and a
 * `byok-key` slot for the consumer's BYOK key UI. Today only `"model"`
 * is accepted; the other modes surface a development console warning
 * rather than silently misbehaving.
 *
 * Data, copy and lifecycle:
 *
 * - `models` (required): consumer-provided catalog with stable `id`
 *   and `name`; provider metadata (`provider.icon`,
 *   `provider.protocol`, `provider.id`) is read for icon resolution
 *   and may be omitted.
 * - `recommendedModels`: array of `model.id`s shown while the search
 *   query is empty (or only whitespace). When the list is empty the
 *   popup simply shows the empty slot.
 * - `searchResults`: array of full `model` entries shown when the
 *   query is non-empty; `update:query` is emitted as the user types so
 *   the consumer can filter or fetch asynchronously.
 * - `loading` and `error` are read by the consumer and communicated
 *   through consumer-owned copy above/below the picker; the component
 *   stays i18n-neutral and ships no built-in loading/error chrome.
 * - `invalid`: validation state on the closed trigger (`is-danger` +
 *   `aria-invalid`); the popup is hidden while closed, so this is what
 *   a screen reader or form-error summary sees.
 *
 * The component imports no Pinia store, no router, no fixtures, no
 * secrets, no i18n runtime and no browser global at module setup time;
 * rendering uses `b-dropdown`/`b-autocomplete`/`b-button`/MDI
 * `chevron-down` from Buefy (required peer).
 */

const SUPPORTED_MODES = ["model"];

const props = defineProps({
  /** @type {import("vue").PropType<"model">} */
  mode: {
    type: String,
    default: "model",
    validator: (value) => value === "model",
  },
  /** @type {import("vue").PropType<Array<{id:string,name:string,provider?:object}>>} */
  models: {
    type: Array,
    required: true,
  },
  /** @type {import("vue").PropType<string[]>} */
  recommendedModels: {
    type: Array,
    default: () => [],
  },
  /** @type {import("vue").PropType<Array<{id:string,name:string,provider?:object}>>} */
  searchResults: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: Boolean,
    default: false,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  inputId: {
    type: String,
    default: null,
  },
  // Consumer-provided, localised texts and accessible names. The empty
  // defaults are intentional: the component ships no in-built user-facing
  // strings; consumers always override at the call site for any locale.
  triggerPlaceholder: {
    type: String,
    default: "",
  },
  searchPlaceholder: {
    type: String,
    default: "",
  },
  triggerAriaLabel: {
    type: String,
    default: null,
  },
  searchAriaLabel: {
    type: String,
    default: null,
  },
  triggerTitle: {
    type: String,
    default: null,
  },
  emptyLabel: {
    type: String,
    default: "",
  },
});

const modelId = defineModel({ type: String, default: null });
const emit = defineEmits(["update:query"]);

const dropdownRef = ref(null);
const triggerRef = ref(null);
const autocompleteRef = ref(null);
const wrapperRef = ref(/** @type {HTMLElement|null} */ (null));
const menuRef = ref(/** @type {HTMLElement|null} */ (null));
const isActive = ref(false);
const popupId = `model-select-${useId()}`;
const searchQuery = ref("");
let focusOutTimer = null;

const isOpen = computed(() => isActive.value);

const trimmedQuery = computed(() => searchQuery.value.trim());
const hasQuery = computed(() => trimmedQuery.value.length > 0);

const modelsById = computed(() => {
  const map = new Map();
  for (const model of props.models) {
    if (model && typeof model.id === "string") {
      map.set(model.id, model);
    }
  }
  return map;
});

const recommendedEntries = computed(() => {
  const out = [];
  for (const id of props.recommendedModels) {
    const model = modelsById.value.get(id);
    if (model) out.push({ ...model, group: "__recommended" });
  }
  return out;
});

// When the query is empty we only show consumer-supplied
// recommendations. When the query is non-empty we only show
// consumer-supplied search results — the component never filters its
// own catalog and never fetches on its own; `update:query` lets the
// consumer drive either path.
const visibleOptions = computed(() => {
  if (!hasQuery.value) {
    return recommendedEntries.value;
  }
  return props.searchResults.map((model) => ({ ...model, group: "__search" }));
});

const canonicalDisplay = computed(() => {
  const id = modelId.value;
  if (id == null || id === "") return "";
  return modelsById.value.get(id)?.name ?? "";
});

function providerIconName(option) {
  const provider = option?.provider;
  return provider?.icon || provider?.protocol || provider?.id || "brain";
}

function isCatalogSelection(option) {
  if (!option || !modelId.value) return false;
  return option.id === modelId.value;
}

function searchInput() {
  return autocompleteRef.value?.$el?.querySelector("input");
}

function focusTrigger() {
  triggerRef.value?.$el?.focus?.();
}

// The trigger's `@keydown.down` opens the dropdown through Buefy's own
// click-driven toggle handler: we delegate to a synthetic click on the
// trigger's button. This keeps Buefy's keyboard/outside-click contract
// the single source of truth for open/close state.
function openPicker() {
  if (props.disabled || isActive.value) return;
  const trigger = triggerRef.value?.$el;
  if (trigger && typeof trigger.click === "function") {
    searchQuery.value = "";
    emit("update:query", "");
    trigger.click();
  }
}

function onSelect(option) {
  if (!option || typeof option.id !== "string") return;
  modelId.value = option.id;
  // Buefy will fire `active-change=false` after the user releases focus
  // outside the menu; we don't close programmatically to preserve its
  // own outside-click handler timing.
  const trigger = triggerRef.value?.$el;
  nextTick(() => {
    trigger?.blur?.();
    focusTrigger();
  });
}

function onFocusOut(event) {
  // A pointer selection emits blur before click. Defer the outside
  // check so Buefy can process that click; focus moving inside the
  // popover keeps the menu open. Note: Buefy's own `clickedOutside`
  // handler also closes the menu; this is purely defensive.
  clearTimeout(focusOutTimer);
  focusOutTimer = setTimeout(() => {
    if (!isActive.value) return;
    const popup = document.getElementById(popupId);
    const newFocus = event?.relatedTarget ?? document.activeElement;
    if (popup && popup.contains(newFocus)) return;
    const trigger = triggerRef.value?.$el;
    trigger?.dispatchEvent?.(new MouseEvent("click", { bubbles: true }));
  }, 0);
}

// --- Overlay / placement wiring ----------------------------------------
//
// Same pattern as `ToolbarDropdown`/`MobileFilters`: refs are refreshed
// after each `active-change` so the first open does not race Buefy's
// DOM work; the placement is computed once at mount (Buefy creates its
// body wrapper inside `mounted()`); switching placement remounts the
// dropdown through its `key`.
function refreshRefs() {
  const dropdownInstance = dropdownRef.value;
  if (!dropdownInstance) return;
  const rootEl = dropdownInstance.$el;
  const trigger = rootEl?.querySelector?.(".dropdown-trigger");
  if (trigger) triggerRef.value = trigger;
  const menu = dropdownInstance.$refs?.dropdownMenu
    ?? rootEl?.querySelector?.(".dropdown-menu")
    ?? null;
  menuRef.value = menu;
  wrapperRef.value = menu?.closest?.(".dropdown")
    ?? (rootEl?.classList?.contains("dropdown") ? rootEl : rootEl?.querySelector?.(".dropdown"))
    ?? rootEl
    ?? null;
}

const positionRef = ref(/** @type {(typeof POSITIONS)[number]} */ ("is-bottom-left"));

const placement = ref(/** @type {"inline"|"fixed"|"portal"} */ ("inline"));
const appendToBody = computed(() => placement.value === "portal");
const pinnedInPlace = computed(() => placement.value === "fixed");

onMounted(() => {
  const rootEl = dropdownRef.value?.$el ?? null;
  placement.value = resolveDropdownPlacement(rootEl);
});

useDropdownOverlay({
  triggerRef,
  menuRef,
  wrapperRef,
  activeRef: isActive,
  positionRef,
  appendToBody,
  fixed: pinnedInPlace,
});

function onActiveChange(next) {
  isActive.value = !!next;
  if (next) {
    // Buefy runs `updateAppendToBody` inside a `$nextTick` after its
    // own watcher flush. Wait one tick so Buefy has populated
    // `$refs.dropdownMenu`, then refresh local refs and focus the
    // search field.
    nextTick().then(() => {
      refreshRefs();
      searchQuery.value = "";
      emit("update:query", "");
      searchInput()?.focus();
    });
  } else {
    nextTick(refreshRefs);
  }
}

watch(searchQuery, (value) => {
  emit("update:query", value);
});

onBeforeUnmount(() => {
  if (focusOutTimer != null) {
    clearTimeout(focusOutTimer);
    focusOutTimer = null;
  }
});
</script>
