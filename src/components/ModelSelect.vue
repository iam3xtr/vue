<template>
  <b-dropdown
    ref="dropdownRef"
    :key="appendToBody ? 'portal' : 'inline'"
    class="tr-model-select"
    :class="[
      `tr-model-select--mode-${mode}`,
      { 'tr-model-select--open': isOpen, 'is-danger': invalid },
    ]"
    :position="positionRef"
    :append-to-body="appendToBody"
    @active-change="onActiveChange"
  >
    <template #trigger>
      <b-button
        ref="triggerButtonRef"
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
        @keydown.enter="onSearchEnter"
      >
        <!--
          `mode === "both"` adds a controlled switch above the search
          row. The switch's value is the consumer's `v-model:useOwnApiKey`;
          flipping it never erases hidden `modelId`/`byokModelId`/
          `providerModelId` — that contract is owned by the consumer.
        -->
        <div
          v-if="mode === 'both'"
          class="tr-model-select__switch-row"
        >
          <label
            class="tr-model-select__switch"
            :class="{ 'is-active': useOwnApiKeyValue }"
          >
            <input
              type="checkbox"
              class="tr-model-select__switch-input"
              :checked="useOwnApiKeyValue"
              :disabled="disabled"
              :aria-label="switchAriaLabel || undefined"
              @change="onSwitchChange"
            >
            <span class="tr-model-select__switch-label">
              {{ switchLabel }}
            </span>
          </label>
        </div>

        <b-autocomplete
          ref="autocompleteRef"
          v-model="searchQuery"
          :data="visibleOptions"
          field="name"
          clear-on-select
          open-on-focus
          dropdown-position="bottom"
          :placeholder="searchPlaceholder"
          :aria-label="searchAriaLabel"
          @select="onCatalogSelect"
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
            <!--
              Free-form path. Visible only for the active BYOK scope
              (`mode === "byok"` or `useOwnApiKey` in `"both"`), only
              with a non-empty trimmed query, only when the consumer
              reported no search results, and never while `loading` is
              on or `error` is set — those should re-use the standard
              status slots. Validation and free-form lifecycle are
              entirely consumer-owned; the package only normalises the
              trimmed string, surfaces its error if any, and emits the
              selection on commit.
            -->
            <div
              v-if="freeformVisible"
              class="tr-model-select__freeform"
            >
              <button
                type="button"
                class="dropdown-item tr-model-select__freeform-action"
                :disabled="!freeformValid"
                :aria-label="freeformActionAriaLabel"
                :title="freeformError || freeformHint"
                @mousedown.prevent.stop="selectFreeform"
                @click.prevent="selectFreeform"
                @keydown.enter.prevent="selectFreeform"
                @keydown.space.prevent="selectFreeform"
              >
                {{ formattedFreeformActionLabel }}
              </button>
              <p
                v-if="freeformError || freeformHint"
                class="tr-model-select__freeform-hint"
              >
                {{ freeformError || freeformHint }}
              </p>
            </div>
            <p
              v-else-if="error"
              class="tr-model-select__empty tr-model-select__empty--error"
              role="alert"
            >
              {{ errorLabel }}
            </p>
            <p
              v-else-if="loading"
              class="tr-model-select__empty tr-model-select__empty--loading"
              role="status"
              aria-busy="true"
            >
              {{ loadingLabel }}
            </p>
            <p
              v-else
              class="tr-model-select__empty"
              role="status"
            >
              {{ emptyLabel }}
            </p>
          </template>
        </b-autocomplete>

        <!--
          Consumer-owned key UI. The package never reads the byok-key
          slot's value, never stores a secret and never participates in
          any API or permission policy; only the rendered DOM is
          placed here.
        -->
        <div
          v-if="$slots['byok-key']"
          class="tr-model-select__byok-key"
        >
          <slot name="byok-key" />
        </div>
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
 * Public model picker.
 *
 * The closed trigger always displays the canonical selection for the
 * current scope. Three scopes share this single component:
 *
 *   - `mode: "model"` — `v-model:modelId` selects one entry from the
 *     consumer-provided `models` catalog. Opening shows only the
 *     consumer-supplied `recommendedModels` while the search query is
 *     empty and only `searchResults` once the user types; the component
 *     never filters its own catalog and never fetches on its own.
 *   - `mode: "byok"` — `v-model:byokModelId` selects a catalog BYOK
 *     entry, `v-model:providerModelId` carries a free-form BYOK
 *     identifier. They are mutually exclusive: picking a catalog id
 *     clears the free-form id and vice versa, while leaving any
 *     unrelated `modelId` alone. When the user types and the consumer
 *     returns no search results, the package surfaces a
 *     consumer-controlled free-form action (trimmed id, no whitespace,
 *     ≤ 255 characters). `loading`/`error` never become a free-form
 *     candidate.
 *   - `mode: "both"` — adds a controlled switch over the search row
 *     bound to `v-model:useOwnApiKey`; the switch is visible only in
 *     this mode and only flips which v-model link drives the canonical
 *     display / `update:query` source. Flipping the switch never
 *     erases the hidden `modelId`/`byokModelId`/`providerModelId`.
 *
 * Catalog and recommendations for the active scope come from the
 * consumer via `models`/`recommendedModels`/`searchResults`. There is
 * exactly one search row — the same one used by `b-autocomplete` — so
 * the component never creates a second `b-dropdown` or an independent
 * search field. The active BYOK catalog is still driven by the
 * consumer's filtering (e.g. OpenRouter scope); this package does not
 * decode provider identifiers or know which provider is which.
 *
 * Optional `byok-key` slot lets the consumer place its key input
 * beneath the popup. The package never reads the slot's value, never
 * stores a secret and never participates in any API or permission
 * policy; the consumer owns the key lifecycle entirely.
 *
 * The component imports no Pinia store, no router, no fixtures, no
 * secrets, no i18n runtime and no browser global at module setup time;
 * rendering uses `b-dropdown`/`b-autocomplete`/`b-button`/MDI
 * `chevron-down` from Buefy (required peer).
 */

const FREEFORM_MAX_LENGTH = 255;

const props = defineProps({
  /** @type {import("vue").PropType<"model" | "byok" | "both">} */
  mode: {
    type: String,
    default: "model",
    validator: (value) => value === "model" || value === "byok" || value === "both",
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
  loadingLabel: {
    type: String,
    default: "",
  },
  errorLabel: {
    type: String,
    default: "",
  },
  // BYOK switch copy (mode === "both"). Consumer-owned.
  switchLabel: {
    type: String,
    default: "",
  },
  switchAriaLabel: {
    type: String,
    default: null,
  },
  // Free-form BYOK action copy (mode === "byok" or mode === "both" with
  // `useOwnApiKey` enabled). The package only formats the action label
  // and hint from these strings + the trimmed query; it never inserts
  // its own user-facing copy.
  freeformActionLabel: {
    type: String,
    default: "",
  },
  freeformActionAriaLabel: {
    type: String,
    default: null,
  },
  freeformHint: {
    type: String,
    default: "",
  },
  freeformErrorLabel: {
    type: String,
    default: "",
  },
});

// Four `v-model` links plus `useOwnApiKey` (controlled in `mode === "both"`,
// ignored otherwise). `defineModel()` is compiled by the SFC compiler and
// produces a writable ref + automatic `update:*` emission; assigning `null`
// (rather than `undefined`) clears the slot the consumer expects, which
// matches the existing draft semantics.
const modelId = defineModel("modelId", { type: String, default: null });
const byokModelId = defineModel("byokModelId", { type: String, default: null });
const providerModelId = defineModel("providerModelId", { type: String, default: null });
const useOwnApiKey = defineModel("useOwnApiKey", { type: Boolean, default: false });
const emit = defineEmits(["update:query"]);

const dropdownRef = ref(null);
// `triggerButtonRef` is the `<b-button>` component instance (template
// ref, owned by Vue); `triggerElRef` is the `.dropdown-trigger` element
// the overlay measures. They are kept separate so a re-render cannot swap
// a component proxy into the overlay's element ref and vice versa.
const triggerButtonRef = ref(null);
const triggerElRef = ref(/** @type {HTMLElement|null} */ (null));
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

// `useOwnApiKey` is only meaningfully controlled in `mode === "both"`;
// the single-mode shortcuts (`model`/`byok`) treat the scope as fixed.
const useOwnApiKeyValue = computed(() => {
  if (props.mode === "byok") return true;
  if (props.mode === "model") return false;
  return useOwnApiKey.value === true;
});

const activeScope = computed(() => (useOwnApiKeyValue.value ? "byok" : "model"));

const isByokScope = computed(() => activeScope.value === "byok");

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
  // The consumer swaps `recommendedModels` for the active scope
  // (`useOwnApiKey` in `mode === "both"`); the component uses one set.
  for (const id of props.recommendedModels) {
    const model = modelsById.value.get(id);
    if (model) out.push(model);
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
  return props.searchResults;
});

// Canonical display is the only thing that drives the closed trigger —
// and the scope decides which v-model link defines "selected".
// The display rule below intentionally mirrors the `.plan` contract:
// `providerModelId` is never read off the closed trigger (it is a
// free-form draft, not a chosen catalog entry), and `byokModelId` only
// participates when the active scope is `byok`.
const canonicalDisplay = computed(() => {
  if (isByokScope.value) {
    if (providerModelId.value && providerModelId.value.length > 0) {
      // Free-form id always wins in display (it's the draft the
      // consumer most recently committed) — even in `"both"` with the
      // switch off, the user typed it last and that's the visible
      // intent. Catalog selection remains a first-class alternative;
      // picking it again clears the free-form (see `selectCatalog`).
      return providerModelId.value;
    }
    const id = byokModelId.value;
    if (id) return modelsById.value.get(id)?.name ?? id;
  }
  const id = modelId.value;
  if (id) return modelsById.value.get(id)?.name ?? "";
  return "";
});

function providerIconName(option) {
  const provider = option?.provider;
  return provider?.icon || provider?.protocol || provider?.id || "brain";
}

// The catalog selection marker renders only for the active v-model
// link. In `mode === "byok"` that means `byokModelId` (the free-form
// `providerModelId` is not a catalog entry and therefore cannot be
// marked). In `mode === "both"` the active scope is `useOwnApiKeyValue`.
function isCatalogSelection(option) {
  if (!option) return false;
  if (isByokScope.value) {
    return byokModelId.value !== null && byokModelId.value !== "" && option.id === byokModelId.value;
  }
  return modelId.value !== null && modelId.value !== "" && option.id === modelId.value;
}

function searchInput() {
  return autocompleteRef.value?.$el?.querySelector("input");
}

function triggerButton() {
  return triggerButtonRef.value?.$el ?? null;
}

function focusTrigger() {
  triggerButton()?.focus?.();
}

// The trigger's `@keydown.down` opens the dropdown through Buefy's own
// click-driven toggle handler: we delegate to a synthetic click on the
// trigger's button. This keeps Buefy's keyboard/outside-click contract
// the single source of truth for open/close state.
function openPicker() {
  if (props.disabled || isActive.value) return;
  const trigger = triggerButton();
  if (trigger && typeof trigger.click === "function") {
    searchQuery.value = "";
    trigger.click();
  }
}

// --- Catalog selection --------------------------------------------------
//
// `selectCatalog` is the single mutation point for picking a catalog
// entry. It enforces the documented exclusivity: in the BYOK scope,
// picking a `byokModelId` clears `providerModelId`; in the regular
// scope, picking a `modelId` is independent of the BYOK links. The
// regular `modelId` is never touched from BYOK selections and vice
// versa, matching the `.plan` requirement.
function selectCatalog(option) {
  if (!option || typeof option.id !== "string") return;
  const id = option.id;
  if (isByokScope.value) {
    byokModelId.value = id;
    if (providerModelId.value !== null) providerModelId.value = null;
  } else {
    modelId.value = id;
  }
  if (isActive.value) triggerButton()?.click?.();
  clearTimeout(focusOutTimer);
  focusOutTimer = null;
  nextTick(focusTrigger);
}

function onCatalogSelect(option) {
  if (!option) return;
  selectCatalog(option);
}

// --- Free-form lifecycle ------------------------------------------------
//
// Free-form is offered only in the BYOK scope, only when the query is
// non-empty after trim, only when the consumer returned no search
// results, and never while loading/error are on. Validation is local
// to this component: the trimmed string must contain no whitespace
// and be no longer than 255 characters. The package never persists
// the value, never sends it to an API, and never calls into a
// provider policy.
const freeformTrimmed = computed(() => trimmedQuery.value);

const freeformError = computed(() => {
  if (!freeformTrimmed.value) return "";
  if (/\s/.test(freeformTrimmed.value)) {
    return props.freeformErrorLabel;
  }
  if (freeformTrimmed.value.length > FREEFORM_MAX_LENGTH) {
    return props.freeformErrorLabel;
  }
  return "";
});

const freeformValid = computed(() => {
  if (!isByokScope.value) return false;
  if (props.loading || props.error) return false;
  if (!freeformTrimmed.value || freeformTrimmed.value.length === 0) return false;
  return freeformError.value === "";
});

const freeformCandidateAvailable = computed(() => {
  if (!isByokScope.value) return false;
  if (props.loading || props.error) return false;
  if (!hasQuery.value) return false;
  return visibleOptions.value.length === 0;
});

const freeformVisible = computed(() => freeformCandidateAvailable.value);

const formattedFreeformActionLabel = computed(() => {
  // The action label accepts `{id}` as a placeholder for the trimmed
  // query; the consumer stays in control of the surrounding copy
  // because the component ships no built-in translations.
  const template = props.freeformActionLabel || "";
  if (!template.includes("{id}")) return template;
  return template.replace("{id}", freeformTrimmed.value);
});

function selectFreeform() {
  if (!freeformValid.value) return;
  // Free-form commits the trimmed string and clears any catalog BYOK
  // id (mutual exclusivity), leaving the regular `modelId` (and any
  // unknown scope) untouched.
  const id = freeformTrimmed.value;
  if (providerModelId.value !== id) providerModelId.value = id;
  if (byokModelId.value !== null) byokModelId.value = null;
  if (isActive.value) triggerButton()?.click?.();
  clearTimeout(focusOutTimer);
  focusOutTimer = null;
  nextTick(focusTrigger);
}

// Keyboard commit for the free-form path. The action lives in
// `b-autocomplete`'s `#empty` slot, which Buefy's keyboard model cannot
// reach: Tab/Escape close the menu, arrows walk the (empty) option list
// and Enter with no hovered option selects nothing. Enter in the search
// input therefore commits the free-form candidate itself; it only acts
// while the candidate is visible (no search results, no loading/error)
// and `selectFreeform` ignores invalid ids.
function onSearchEnter(event) {
  if (event?.isComposing) return;
  if (!freeformVisible.value) return;
  const input = searchInput();
  if (!input || event?.target !== input) return;
  selectFreeform();
}

function onSwitchChange(event) {
  // The component owns no copy and no policy: flipping the switch
  // only updates the consumer's `v-model:useOwnApiKey`. Hidden
  // `modelId`/`byokModelId`/`providerModelId` are intentionally
  // preserved; switching back returns the user to the same draft.
  useOwnApiKey.value = !!event?.target?.checked;
}

function onFocusOut(event) {
  clearTimeout(focusOutTimer);
  focusOutTimer = setTimeout(() => {
    if (!isActive.value) return;
    const popup = document.getElementById(popupId);
    const newFocus = event?.relatedTarget ?? document.activeElement;
    if (popup && popup.contains(newFocus)) return;
    triggerButton()?.dispatchEvent?.(new MouseEvent("click", { bubbles: true }));
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
  triggerElRef.value = trigger ?? null;
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
  triggerRef: triggerElRef,
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
    nextTick().then(() => {
      refreshRefs();
      searchQuery.value = "";
      searchInput()?.focus();
    });
  } else {
    nextTick(refreshRefs);
  }
}

// `update:query` fires only when the query really changes, so resetting
// an already-empty query on open emits nothing.
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
