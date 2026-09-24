// =============================================================================
// useDropdownOverlay — общий positioning layer для `b-dropdown`
// =============================================================================
// Зачем: Buefy 3.x поддерживает четыре `position` (`is-bottom-left` и т.д.),
// но сам не делает flip к ближайшей границе и не обновляет координаты на
// scroll/resize — меню может уехать за нижний край viewport. В обычном режиме
// `.dropdown-menu` позиционируется CSS-классом, в `append-to-body` —
// `updateAppendToBody()` один раз выставляет inline `top`/`left`/`z-index: 99`
// и больше ничего не двигает. Этот composable:
//
//   - измеряет trigger/menu/viewport при открытии и на scroll/resize;
//   - при недостатке места снизу переключает позицию снизу наверх (и наоборот)
//     и пишет итог в `position` ref, привязанный caller-ом к `b-dropdown`'s
//     `position` prop;
//   - ставит явный marker class на меню (и на body-обёртку, если portal),
//     чтобы theme в `@iam3xtr/ui` стилизовал обе формы через одинаковые
//     селекторы;
//   - в body-режиме понижает Buefy `z-index: 99` до token-шкалы
//     `@iam3xtr/ui` (`--tr-z-dropdown`, ниже modal/drawer), иначе portal
//     перекрывал бы `b-modal`/`b-sidebar`;
//   - снимает собственные listeners и pending frame на close/unmount и не
//     трогает обработчики Buefy (Escape, outside-click, mobile-modal,
//     focus trap, teleport lifecycle).
//
// SSR-safe: импорт не обращается к `window`/`document`. Вся браузерная работа —
// в lifecycle hooks с парной очисткой.

import { nextTick, onBeforeUnmount, watch } from "vue";

// Один источник истины для marker class: и inline, и body-portal меню должны
// попадать под одинаковые theme-селекторы (см. `.tr-dropdown-overlay` в
// `@iam3xtr/ui/theme.scss`).
export const DROPDOWN_OVERLAY_MARKER = "tr-dropdown-overlay";

// Marker на body-обёртке, чтобы theme мог отличить portal от inline меню
// (например, шириной, привязкой к content-gutter, отличной реакцией на
// `clip-path`/transform-предков).
const PORTAL_MARKER = "tr-dropdown-overlay-portal";

// Четыре Buefy позиции. Caller привязывает итоговую позицию к `b-dropdown`'s
// `position` prop через `positionRef`.
export const POSITIONS = /** @type {const} */ ([
  "is-bottom-left",
  "is-bottom-right",
  "is-top-left",
  "is-top-right",
]);

const isBottom = (pos) => pos === "is-bottom-left" || pos === "is-bottom-right";

// Флип вертикали (`-bottom-*` ↔ `-top-*`); горизонталь вызова сохраняется.
const flipVertical = (pos) =>
  isBottom(pos) ? pos.replace("is-bottom-", "is-top-") : pos.replace("is-top-", "is-bottom-");

// Глобальный z-index токен. Theme объявляет его в `:root` через
// `--tr-z-dropdown` (см. tokens.scss). При отсутствии CSS-переменной
// падаем на согласованное число, совпадающее со шкалой Bulma-token.
const FALLBACK_Z = 35;

const readZ = () => {
  if (typeof document === "undefined") return FALLBACK_Z;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--tr-z-dropdown")
    .trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : FALLBACK_Z;
};

// `requestAnimationFrame` единожды на одно открытие/scroll-событие, чтобы не
// дёргать измерения чаще, чем экран успевает перерисоваться.
const scheduleFrame = (cb) => {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    cb();
    return () => {};
  }
  let id = window.requestAnimationFrame(cb);
  return () => {
    if (id != null) {
      window.cancelAnimationFrame(id);
      id = null;
    }
  };
};

const VIEWPORT_EDGE_GAP = 8; // px от границы viewport, после которого флипаем

const spaceBelow = (rect) =>
  (typeof window !== "undefined" ? window.innerHeight : 0) - rect.bottom;
const spaceAbove = (rect) => rect.top;

/**
 * @typedef {Object} UseDropdownOverlayOptions
 * @property {import("vue").Ref<HTMLElement|null>} triggerRef — триггер-кнопка
 *   (или другой anchor-элемент). Используется для измерения положения
 *   относительно viewport.
 * @property {import("vue").Ref<HTMLElement|null>} menuRef — `.dropdown-menu`,
 *   который Buefy создаёт (для portal: после `append-to-body` он живёт в
 *   body; для inline: внутри корня `.dropdown`). Composables использует его
 *   для измерения размеров и для marker/z-index.
 * @property {import("vue").Ref<HTMLElement|null>} wrapperRef — корневой
 *   `.dropdown` (inline) или body-обёртка (portal). Принимает
 *   `tr-dropdown-overlay-portal` marker в portal-режиме.
 * @property {import("vue").Ref<boolean>} activeRef — текущее состояние
 *   открытия (зеркало Buefy `active-change`).
 * @property {import("vue").Ref<string>} positionRef — двунаправленная
 *   связь с Buefy `position` prop. Caller инициализирует стартовой
 *   позицией; composable пишет сюда вычисленную позицию, чтобы Buefy
 *   перерисовал класс корня и CSS-позиционирование.
 * @property {boolean} [appendToBody] — признак body-portal режима; включает
 *   portal marker и z-index override.
 * @property {number} [edgeGap] — отступ от границы viewport (px), после
 *   которого флипаем. По умолчанию 8.
 */

/**
 * Подключает auto-flip + portal marker + token z-index к существующему
 * `b-dropdown`. Не вызывает private Buefy-методы и не подменяет его
 * обработчики Escape/outside-click/mobile-modal/focus-trap.
 *
 * @param {UseDropdownOverlayOptions} options
 * @returns {{
 *   reapply: () => void,
 * }}
 */
export function useDropdownOverlay(options) {
  const {
    triggerRef,
    menuRef,
    wrapperRef,
    activeRef,
    positionRef,
    appendToBody = false,
    edgeGap = VIEWPORT_EDGE_GAP,
  } = options;

  // Сохраняем оригинальный Buefy-выставленный `z-index`, чтобы восстановить
  // его при закрытии — иначе закрытое меню оставит бы стиль у body-обёртки
  // видимым до повторного открытия.
  let originalZ = null;
  let detachFns = [];
  let cancelFrame = null;
  let portalMarkerApplied = false;
  let menuMarkerApplied = false;
  let listenersAttached = false;

  const detachListeners = () => {
    for (const off of detachFns) off();
    detachFns = [];
    if (cancelFrame) {
      cancelFrame();
      cancelFrame = null;
    }
    listenersAttached = false;
  };

  const setZIndex = (el) => {
    if (!el) return;
    const z = readZ();
    if (originalZ == null) {
      const inline = el.style.getPropertyValue("z-index");
      originalZ = inline || null;
    }
    el.style.setProperty("z-index", String(z));
  };

  const restoreZIndex = (el) => {
    if (!el) return;
    if (originalZ != null) {
      el.style.setProperty("z-index", originalZ);
    } else {
      el.style.removeProperty("z-index");
    }
    originalZ = null;
  };

  const setPortalMarker = (on) => {
    const wrapper = wrapperRef.value;
    if (!wrapper) return;
    if (on && !wrapper.classList.contains(PORTAL_MARKER)) {
      wrapper.classList.add(PORTAL_MARKER);
      portalMarkerApplied = true;
    } else if (!on && wrapper.classList.contains(PORTAL_MARKER)) {
      wrapper.classList.remove(PORTAL_MARKER);
      portalMarkerApplied = false;
    }
  };

  const removePortalMarker = () => setPortalMarker(false);

  const setMenuMarker = (on) => {
    const menu = menuRef.value;
    if (!menu) return;
    if (on && !menu.classList.contains(DROPDOWN_OVERLAY_MARKER)) {
      menu.classList.add(DROPDOWN_OVERLAY_MARKER);
      menuMarkerApplied = true;
    } else if (!on && menu.classList.contains(DROPDOWN_OVERLAY_MARKER)) {
      menu.classList.remove(DROPDOWN_OVERLAY_MARKER);
      menuMarkerApplied = false;
    }
  };

  const measure = () => {
    const trigger = triggerRef.value;
    const menu = menuRef.value;
    if (!trigger || !menu) return null;
    return {
      triggerRect: trigger.getBoundingClientRect(),
      menuRect: menu.getBoundingClientRect(),
    };
  };

  // Решаем, нужно ли флипнуть. Решение принимается по triggerRect (положение
  // триггера в viewport) — меню в inline-режиме позиционируется относительно
  // него же, так что координата trigger.bottom + menuHeight предсказывает
  // нижнюю границу меню; в body-режиме это менее точно (Buefy использует
  // scrollY + rect.top + trigger.clientHeight), но для флипа достаточно
  // знать, помещается ли меню снизу в видимой области.
  const decide = (position, m) => {
    if (!m) return position;
    const { triggerRect, menuRect } = m;
    const menuH = menuRect.height || 0;
    if (isBottom(position)) {
      if (spaceBelow(triggerRect) < menuH + edgeGap && spaceAbove(triggerRect) > menuH) {
        return flipVertical(position);
      }
    } else {
      if (spaceAbove(triggerRect) < menuH + edgeGap && spaceBelow(triggerRect) > menuH) {
        return flipVertical(position);
      }
    }
    return position;
  };

  // Применяем решение: пишем итоговую позицию в positionRef (Buefy
  // реактивно пересчитает классы и CSS-позицию), для body-portal ещё
  // корректируем inline top вручную, поскольку Buefy рисует portal один
  // раз и сам не обновляет координаты после смены position.
  const apply = () => {
    const position = positionRef.value;
    const m = measure();
    const target = decide(position, m);
    if (target !== position) {
      positionRef.value = target;
    }

    if (appendToBody) {
      const menu = menuRef.value;
      const trigger = triggerRef.value;
      if (menu && trigger) {
        const rect = trigger.getBoundingClientRect();
        const menuH = menu.getBoundingClientRect().height || 0;
        const triggerH = trigger.offsetHeight || 0;
        let top = rect.top + (typeof window !== "undefined" ? window.scrollY : 0);
        if (isBottom(target)) {
          top += triggerH;
        } else {
          top -= menuH;
        }
        menu.style.setProperty("top", `${top}px`);
        setZIndex(menu);
      }
    }
  };

  const attachListeners = () => {
    if (typeof window === "undefined" || listenersAttached) return;
    const onScrollOrResize = () => {
      if (cancelFrame) cancelFrame();
      cancelFrame = scheduleFrame(() => {
        cancelFrame = null;
        apply();
      });
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    detachFns.push(() => window.removeEventListener("scroll", onScrollOrResize, true));
    detachFns.push(() => window.removeEventListener("resize", onScrollOrResize));
    listenersAttached = true;
  };

  const onOpen = async () => {
    setPortalMarker(appendToBody);
    setMenuMarker(true);
    if (appendToBody) {
      setZIndex(menuRef.value);
    }
    await nextTick();
    apply();
    attachListeners();
  };

  const onClose = () => {
    detachListeners();
    if (appendToBody) {
      restoreZIndex(menuRef.value);
      removePortalMarker();
    }
    setMenuMarker(false);
  };

  watch(activeRef, (isActive) => {
    if (isActive) {
      onOpen();
    } else {
      onClose();
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    onClose();
    // На случай, если caller выкинул компонент, не сбросив marker на меню.
    if (menuMarkerApplied) setMenuMarker(false);
    if (portalMarkerApplied) removePortalMarker();
  });

  // Экспортируем хелпер для тестов: ручной re-apply без ожидания rAF/scroll.
  return {
    reapply: () => apply(),
  };
}