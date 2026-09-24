<template>
  <b-dropdown
    ref="dropdownRef"
    v-model="model"
    class="tr-dropdown tr-toolbar-dropdown"
    :position="positionRef"
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
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";

import {
  DROPDOWN_OVERLAY_POSITIONS,
  useDropdownOverlay,
} from "../composables/useDropdownOverlay.js";

/**
 * @typedef {Object} ToolbarDropdownOption
 * @property {string} value
 * @property {string} label
 */

/**
 * A single-select `b-dropdown` filter with a trailing "show all" option,
 * used used in `Toolbar`'s `filters` slot.
 *
 * Props: `options` (required — array of `{ value, label }` or plain
 * strings, in which case the string is used as both), `allLabel` (required
 * — text of the trailing reset option, and the trigger's fallback label
 * when nothing is selected), `ariaLabel` (defaults to `allLabel`).
 * `v-model` (required): the selected `value`, or `""` for "all".
 *
 * Внутри вызывает общий overlay-composable, чтобы открытое меню
 * перекрывало следующий контент и переворачивалось вверх при
 * недостатке места снизу. Auto-flip управляет `b-dropdown`'s `position`
 * prop через локальный ref.
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
// `b-dropdown` не экспонирует свои `trigger`/`dropdownMenu`/`dropdown`
// refs публично (это часть его private шаблона), поэтому мы ищем их
// через `nextTick` после mount и обновляем refs при следующих рендерах
// (на случай, если Buefy пересоздаёт узлы). Композабл принимает
// element-refs и сам снимает listeners/portal marker на close/unmount.

const dropdownRef = useTemplateRef("dropdownRef");
const triggerRef = useTemplateRef("triggerRef");
const wrapperRef = ref(/** @type {HTMLElement|null} */ (null));
const menuRef = ref(/** @type {HTMLElement|null} */ (null));
const isActive = ref(false);

const refreshRefs = () => {
  const dropdownEl = dropdownRef.value?.$el ?? dropdownRef.value;
  if (!dropdownEl) return;
  // Корневой `.dropdown` Buefy — это сам элемент `b-dropdown`. Если
  // Buefy рендерит вложенный div, ищем ближайший `.dropdown` ancestor.
  wrapperRef.value = dropdownEl.classList?.contains("dropdown")
    ? dropdownEl
    : dropdownEl.querySelector?.(".dropdown") ?? dropdownEl;
  menuRef.value = wrapperRef.value?.querySelector?.(".dropdown-menu") ?? null;
};

const positionRef = ref(/** @type {typeof DROPDOWN_OVERLAY_POSITIONS[number]} */ (
  "is-bottom-left"
));

useDropdownOverlay({
  triggerRef,
  menuRef,
  wrapperRef,
  activeRef: isActive,
  positionRef,
  appendToBody: false,
});

// `active-change` — единственный публичный сигнал Buefy об открытии/
// закрытии. Не пытаемся читать `v-model` через `dropdownRef` (Buefy не
// публикует `isActive` через ref API).
const onActiveChange = (next) => {
  isActive.value = !!next;
};

// После первого открытия Buefy создаёт `.dropdown-menu` (он скрыт при
// закрытии через `v-show`); обновляем refs, чтобы композабл видел
// актуальные элементы.
watch(isActive, async (next) => {
  if (!next) return;
  await nextTick();
  refreshRefs();
});

defineExpose({ refreshRefs });
</script>
