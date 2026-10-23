<template>
  <b-dropdown
    :key="appendToBody ? 'portal' : 'inline'"
    ref="dropdownRef"
    v-bind="$attrs"
    class="tr-filter-select"
    :position="positionRef"
    :append-to-body="appendToBody"
    :disabled="disabled || loading"
    :trigger-tabindex="-1"
    :close-on-click="false"
    @active-change="onActiveChange"
  >
    <template #trigger>
      <button
        ref="buttonRef"
        type="button"
        class="button tr-filter-select__trigger"
        :disabled="disabled || loading"
        :aria-label="ariaLabel"
        aria-haspopup="listbox"
        :aria-expanded="isActive ? 'true' : 'false'"
        :aria-controls="listboxId"
        :aria-busy="loading ? 'true' : undefined"
        :title="selectedLabels.join(', ') || placeholder"
        @keydown.down.prevent.stop="open()"
        @keydown.up.prevent.stop="open(true)"
        @keydown.esc="onEscape"
        @keyup.esc="onEscapeUp"
      >
        <span class="tr-filter-select__value">{{ selectionText }}</span>
        <b-icon icon="chevron-down" size="is-small" aria-hidden="true" />
      </button>
    </template>

    <b-dropdown-item custom :focusable="false">
      <div
        ref="popupRef"
        class="tr-filter-select__popup"
        @keydown.esc="onEscape"
        @keyup.esc="onEscapeUp"
      >
        <input
          v-if="searchable"
          ref="searchRef"
          v-model="query"
          type="search"
          class="input tr-filter-select__search"
          autocomplete="off"
          :aria-label="searchLabel"
          :placeholder="searchPlaceholder"
          :aria-controls="listboxId"
          :disabled="disabled || loading"
          @keydown="onSearchKeydown"
        >
        <div
          :id="listboxId"
          ref="listRef"
          role="listbox"
          :aria-label="ariaLabel"
          :aria-multiselectable="multiple ? 'true' : undefined"
          :aria-busy="loading ? 'true' : undefined"
          @keydown="onListKeydown"
        >
          <button
            v-for="option in visibleOptions"
            :key="option.value"
            type="button"
            role="option"
            class="tr-filter-select__option"
            :class="{ 'is-selected': isSelected(option.value), 'is-historical': option.historical }"
            :data-value="option.value"
            :aria-selected="isSelected(option.value) ? 'true' : 'false'"
            :disabled="disabled || loading || option.disabled"
            :tabindex="focusValue === option.value ? 0 : -1"
            @focus="focusValue = option.value"
            @click.stop="select(option)"
          >
            <span>{{ option.label }}</span>
            <span v-if="isSelected(option.value)" aria-hidden="true">✓</span>
          </button>
          <p v-if="stateText" class="tr-filter-select__state">{{ stateText }}</p>
        </div>
        <button
          v-if="allowCustom && candidateText"
          type="button"
          class="tr-filter-select__custom"
          :disabled="disabled || loading"
          @click.stop="commitCustom()"
        >{{ customLabel?.replaceAll("{value}", candidateText) }}</button>
        <p v-if="customError" class="tr-filter-select__state" role="alert">
          {{ customError === "duplicate" ? customDuplicateLabel : customInvalidLabel }}
        </p>
        <button
          type="button"
          class="tr-filter-select__reset"
          :disabled="disabled || loading || !selectedValues.length"
          @click.stop="reset()"
        >{{ resetLabel }}</button>
      </div>
    </b-dropdown-item>
  </b-dropdown>
  <span class="is-sr-only" role="status" aria-live="polite">{{ loading ? loadingLabel : selectionText }}</span>
</template>

<script setup>
defineOptions({ inheritAttrs: false });

import { computed, nextTick, onMounted, ref, useId, watch } from "vue";
import { useCopyDiagnostics } from "../composables/useCopyDiagnostics.js";
import { POSITIONS, resolveDropdownPlacement, useDropdownOverlay } from "../composables/useDropdownOverlay.js";

/**
 * Controlled, non-searchable generic FilterSelect (no API/catalog fetching).
 * Options: { value: string, label: string, disabled?: boolean }[]. Values must
 * be non-empty strings and labels nonblank strings. Invalid options are ignored;
 * duplicate values use their first valid option. No coercion/trim is applied.
 * Single v-model is string|null (null resets); multiple=true uses string[] ([]
 * resets). Duplicate model values display once, preserving first occurrence order.
 * Multi toggles append a new ID or remove every occurrence of an ID; emitted
 * arrays are fresh. Neither input arrays/options nor catalogs are ever mutated.
 * Unknown selected IDs remain selected/displayed as IDs when catalogs change.
 * Opening, focusing, disabled/loading and catalog replacement never emit updates.
 * A single pick closes/returns focus; a multi pick stays open. Reset emits only
 * when nonempty and returns focus to the trigger. Disabled/loading block commits.
 *
 * Optional search (searchable): case-insensitive local substring match of the
 * trimmed query against option label and value; the query never changes the
 * selection, resets on close and an empty query shows all options. Selected IDs
 * absent from the catalog are listed first as historical entries (searchable or
 * allowCustom only) so multi selections can remove them; reset removes any.
 * Search never auto-selects: Enter in the field commits only through the opt-in
 * allowCustom path; ArrowDown moves focus to the list. Keys during IME
 * composition are ignored and Enter never submits an enclosing form.
 * Custom entry (allowCustom): an explicit Enter or click on the add row passes
 * the query through normalizeCustom (default trim) and validateCustom (default
 * nonempty); invalid or already-selected values emit nothing and show copy. A
 * value equal to an unselected catalog option selects that option. Multi appends
 * and stays open; single closes.
 *
 * Required consumer copy: ariaLabel (trigger/listbox), placeholder, resetLabel,
 * selectedCountLabel (multiple selection; template with {count}), emptyLabel when
 * options are empty and loadingLabel while loading; searchLabel and
 * noResultsLabel when searchable; customLabel ("{value}" template),
 * customInvalidLabel and customDuplicateLabel when allowCustom. No language defaults. Missing
 * names warn in development. Option labels and selected IDs are consumer data.
 * Selection is announced through aria-selected and a polite consumer-owned status.
 * Native buttons use roving focus: arrows/Home/End move without selecting;
 * Enter/Space activate the focused option, Escape closes and returns focus.
 * Buefy owns outside click, mobile presentation and Tab trapping; shared overlay
 * placement adds viewport bounds and cleans its styles/listeners on close.
 * Requires Buefy and @iam3xtr/ui filter styles; import/setup are SSR-safe.
 */
const props = defineProps({
  modelValue: { type: [String, Array], default: null },
  options: { type: Array, default: () => [] },
  multiple: Boolean,
  disabled: Boolean,
  loading: Boolean,
  ariaLabel: String,
  placeholder: String,
  resetLabel: String,
  selectedCountLabel: String,
  emptyLabel: String,
  loadingLabel: String,
  searchable: Boolean,
  searchLabel: String,
  searchPlaceholder: String,
  noResultsLabel: String,
  allowCustom: Boolean,
  customLabel: String,
  customInvalidLabel: String,
  customDuplicateLabel: String,
  normalizeCustom: { type: Function, default: undefined },
  validateCustom: { type: Function, default: undefined },
});
const emit = defineEmits(["update:modelValue"]);
const uniqueValues = (values) => [...new Set(values.filter((v) => typeof v === "string" && v.length > 0))];
const selectedValues = computed(() => uniqueValues(props.multiple
  ? (Array.isArray(props.modelValue) ? props.modelValue : [])
  : (typeof props.modelValue === "string" ? [props.modelValue] : [])));
const normalizedOptions = computed(() => {
  const seen = new Set();
  return props.options.filter((option) => {
    if (!option || typeof option.value !== "string" || !option.value.length
      || typeof option.label !== "string" || !option.label.trim() || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
});
const query = ref("");
const customError = ref(null);
watch(query, () => { customError.value = null; });
const needle = computed(() => query.value.trim().toLocaleLowerCase());
const showHistorical = computed(() => props.searchable || props.allowCustom);
const visibleOptions = computed(() => {
  const known = new Set(normalizedOptions.value.map((option) => option.value));
  const historical = showHistorical.value
    ? selectedValues.value.filter((value) => !known.has(value)).map((value) => ({ value, label: value, historical: true }))
    : [];
  const all = [...historical, ...normalizedOptions.value];
  if (!props.searchable || !needle.value) return all;
  return all.filter((option) => option.label.toLocaleLowerCase().includes(needle.value)
    || option.value.toLocaleLowerCase().includes(needle.value));
});
const stateText = computed(() => {
  if (props.loading) return props.loadingLabel;
  if (!normalizedOptions.value.length && !visibleOptions.value.length) return props.emptyLabel;
  if (props.searchable && needle.value && !visibleOptions.value.length) return props.noResultsLabel;
  return "";
});
const candidateText = computed(() => {
  if (!needle.value) return "";
  const raw = props.normalizeCustom ? props.normalizeCustom(query.value) : query.value.trim();
  return typeof raw === "string" ? raw : "";
});
function commitCustom() {
  if (props.disabled || props.loading || !props.allowCustom) return;
  const value = candidateText.value;
  const valid = value.length > 0 && (props.validateCustom ? props.validateCustom(value) === true : true);
  if (!valid) { customError.value = "invalid"; return; }
  if (isSelected(value)) { customError.value = "duplicate"; return; }
  const existing = normalizedOptions.value.find((option) => option.value === value);
  if (existing?.disabled) { customError.value = "invalid"; return; }
  customError.value = null;
  query.value = "";
  if (existing) { select(existing); return; }
  if (props.multiple) {
    emit("update:modelValue", [...selectedValues.value, value]);
    nextTick(() => searchRef.value?.focus());
  } else {
    emit("update:modelValue", value);
    close();
  }
}
const selectedLabels = computed(() => selectedValues.value.map((value) =>
  normalizedOptions.value.find((option) => option.value === value)?.label ?? value));
const selectionText = computed(() => {
  if (!selectedValues.value.length) return props.placeholder;
  if (!props.multiple) return selectedLabels.value[0];
  return props.selectedCountLabel?.replaceAll("{count}", String(selectedValues.value.length));
});
const isSelected = (value) => selectedValues.value.includes(value);
function select(option) {
  if (props.disabled || props.loading || option.disabled) return;
  if (props.multiple) {
    emit("update:modelValue", isSelected(option.value)
      ? selectedValues.value.filter((value) => value !== option.value)
      : [...selectedValues.value, option.value]);
  } else {
    if (props.modelValue !== option.value) emit("update:modelValue", option.value);
    close();
  }
}
function reset() {
  if (props.disabled || props.loading || !selectedValues.value.length) return;
  emit("update:modelValue", props.multiple ? [] : null);
  close();
}

const dropdownRef = ref(null);
const buttonRef = ref(null);
const popupRef = ref(null);
const menuRef = ref(null);
const wrapperRef = ref(null);
const triggerRef = ref(null);
const isActive = ref(false);
const focusValue = ref(null);
const listboxId = `filter-select-${useId()}`;
let focusLast = false;
const searchRef = ref(null);
const listRef = ref(null);
const enabledOptions = computed(() => visibleOptions.value.filter((o) => !o.disabled));
function focusOption(value) {
  focusValue.value = value;
  nextTick(() => {
    const buttons = popupRef.value?.querySelectorAll('[role="option"]') ?? [];
    [...buttons].find((button) => button.dataset.value === value)?.focus();
  });
}
const composing = (event) => event.isComposing || event.keyCode === 229;
function onSearchKeydown(event) {
  if (composing(event)) return;
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    if (props.allowCustom) commitCustom();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    event.stopPropagation();
    const options = enabledOptions.value;
    const target = options.find((o) => isSelected(o.value)) ?? options[0];
    if (target) focusOption(target.value);
  }
}
function onListKeydown(event) {
  if (composing(event)) return;
  const options = enabledOptions.value;
  if (event.key === "ArrowUp" && props.searchable
    && (!options.length || options[0].value === focusValue.value)) {
    event.preventDefault();
    event.stopPropagation();
    searchRef.value?.focus();
    return;
  }
  if (!options.length) return;
  const index = options.findIndex((o) => o.value === focusValue.value);
  let target;
  if (event.key === "ArrowDown") target = (index + 1) % options.length;
  if (event.key === "ArrowUp") target = (index - 1 + options.length) % options.length;
  if (event.key === "Home") target = 0;
  if (event.key === "End") target = options.length - 1;
  if (event.key === "Enter" || event.key === " ") {
    const option = options.find((o) => o.value === focusValue.value);
    if (option) {
      event.preventDefault();
      event.stopPropagation();
      select(option);
    }
    return;
  }
  if (target === undefined) return;
  event.preventDefault();
  event.stopPropagation();
  focusOption(options[target].value);
}
function open(last = false) {
  if (props.disabled || props.loading) return;
  focusLast = last;
  if (!isActive.value) dropdownRef.value?.toggle();
}
let escapeConsumed = false;
function onEscape(event) {
  if (!isActive.value || composing(event)) return;
  event.preventDefault();
  event.stopPropagation();
  escapeConsumed = true;
  close();
}
function onEscapeUp(event) {
  if (!escapeConsumed) return;
  event.preventDefault();
  event.stopPropagation();
  escapeConsumed = false;
}
function close() {
  if (!isActive.value) return;
  dropdownRef.value.isActive = false;
  nextTick(() => buttonRef.value?.focus());
}
function refreshRefs() {
  const instance = dropdownRef.value;
  const root = instance?.$el;
  triggerRef.value = root?.querySelector?.(".dropdown-trigger") ?? null;
  const menu = instance?.$refs?.dropdownMenu ?? root?.querySelector?.(".dropdown-menu");
  menuRef.value = menu ?? null;
  wrapperRef.value = menu?.closest?.(".dropdown") ?? root ?? null;
}
async function onActiveChange(value) {
  isActive.value = !!value;
  await nextTick();
  refreshRefs();
  if (!value) { query.value = ""; customError.value = null; return; }
  if (props.searchable && !focusLast) { searchRef.value?.focus(); return; }
  const options = enabledOptions.value;
  const chosen = options.find((o) => isSelected(o.value));
  const target = focusLast ? options.at(-1) : (chosen ?? options[0]);
  focusLast = false;
  if (target) focusOption(target.value);
  else popupRef.value?.querySelector(".tr-filter-select__reset")?.focus();
}
watch(() => props.disabled || props.loading, (blocked) => { if (blocked) close(); });
watch(enabledOptions, (options) => {
  if (options.some((o) => o.value === focusValue.value)) return;
  const hadFocus = typeof document !== "undefined" && listRef.value?.contains(document.activeElement);
  focusValue.value = options[0]?.value ?? null;
  if (isActive.value && hadFocus && focusValue.value) focusOption(focusValue.value);
});
const positionRef = ref(POSITIONS.includes("is-bottom-right") ? "is-bottom-right" : POSITIONS[0]);
const placement = ref("inline");
const appendToBody = computed(() => placement.value === "portal");
const fixed = computed(() => placement.value === "fixed");
onMounted(() => { placement.value = resolveDropdownPlacement(dropdownRef.value?.$el); });
useDropdownOverlay({ triggerRef, menuRef, wrapperRef, activeRef: isActive,
  positionRef, appendToBody, fixed, viewportBounds: true });
useCopyDiagnostics("FilterSelect", {
  ariaLabel: () => props.ariaLabel,
  placeholder: () => props.placeholder,
  resetLabel: () => props.resetLabel,
  selectedCountLabel: () => !props.multiple || !selectedValues.value.length || props.selectedCountLabel,
  emptyLabel: () => props.loading || normalizedOptions.value.length > 0 || props.emptyLabel,
  searchLabel: () => !props.searchable || props.searchLabel,
  noResultsLabel: () => !props.searchable || props.noResultsLabel,
  customLabel: () => !props.allowCustom || props.customLabel,
  customInvalidLabel: () => !props.allowCustom || props.customInvalidLabel,
  customDuplicateLabel: () => !props.allowCustom || props.customDuplicateLabel,
  loadingLabel: () => !props.loading || props.loadingLabel,
});
</script>
