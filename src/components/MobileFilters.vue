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
import { nextTick, ref, useTemplateRef, watch } from "vue";

import {
  DROPDOWN_OVERLAY_POSITIONS,
  useDropdownOverlay,
} from "../composables/useDropdownOverlay.js";

/**
 * Below `Toolbar`'s own filter-pill breakpoint, the inline mode filters
 * are hidden by CSS; this trigger/panel is the only way to reach them,
 * so `Toolbar` renders the same filters slot content a second time
 * through here instead of wrapping to a second toolbar row.
 *
 * Props: `active` (Boolean — flags the trigger as "has active filters";
 * this component has no visibility into the slot content's own state,
 * so the caller computes it), `triggerAriaLabel`/`triggerTitle` (accessible
 * name and tooltip for the trigger button — override for a non-Russian
 * consumer).
 * Slot: default — the filters panel content.
 *
 * `append-to-body` обязателен — меню содержит вложенные фильтры,
 * которые могут вылезать за clipping-родителя, и его позиция/уровень
 * должны жить независимо от toolbar-контейнера. Overlay-comоб
 * ставит portal marker на body-обёртку и понижает Buefy `z-index: 99`
 * до token-шкалы `@iam3xtr/ui` (`--tr-z-dropdown`), чтобы меню не
 * оказалось поверх `b-modal`/`b-sidebar`.
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
  // В body-portal режиме Buefy перемещает `.dropdown-menu` в
  // `body > div > div.dropdown.dropdown-menu-animation.is-*` (см. Buefy
  // `createAbsoluteElement`). Оригинальный `<b-dropdown>` остаётся, но
  // его `.dropdown-menu` уже нет рядом с триггером — на нём нет класса
  // позиции. Триггер остаётся внутри оригинального корня и читается
  // через `.dropdown-trigger` напрямую; обёртка и меню ищутся в
  // `document.body` по их class-маркерам, потому что у body-обёртки
  // единственной на компонент есть `is-mobile-modal` плюс
  // `dropdown-menu-animation`, тогда как оригинал остался без позиции.
  const dropdownEl = dropdownRef.value?.$el ?? dropdownRef.value;
  if (!dropdownEl) return;
  const trigger = dropdownEl.querySelector?.(".dropdown-trigger");
  if (trigger) triggerRef.value = trigger;
  const allMenus = Array.from(document.body.querySelectorAll(".dropdown-menu"));
  const portalMenu = allMenus.find((m) => m.closest(".dropdown") !== dropdownEl);
  menuRef.value = portalMenu ?? null;
  wrapperRef.value = portalMenu?.closest(".dropdown") ?? dropdownEl;
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
  appendToBody: true,
});

const onActiveChange = (next) => {
  isActive.value = !!next;
};

watch(isActive, async (next) => {
  if (!next) return;
  await nextTick();
  refreshRefs();
});

defineExpose({ refreshRefs });
</script>
