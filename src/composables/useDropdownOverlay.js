// =============================================================================
// useDropdownOverlay — shared positioning layer for `b-dropdown`
// =============================================================================
//
// Buefy 3.x's `b-dropdown` supports four `position` classes
// (`is-bottom-left`, `is-top-right`, etc.) but does not auto-flip away from
// the viewport edge and does not reposition on scroll/resize. In inline mode
// the menu is positioned purely by CSS, so changing the position class does
// flip it; in `append-to-body` mode Buefy's `updateAppendToBody()` writes
// inline `top`/`left`/`z-index: 99` once on every `isActive` change —
// and clears the wrapper classList before re-applying its own classes. This
// composable:
//
//   - measures the trigger and the open menu against the viewport at
//     activation time and on every scroll/resize;
//   - flips `is-bottom-*` ↔ `is-top-*` by writing into the `position` ref
//     the caller has bound to `b-dropdown`'s `position` prop (Buefy then
//     reactively re-renders the wrapper class);
//   - re-installs the `tr-dropdown-overlay-portal` marker and the
//     `--tr-z-dropdown`-scaled z-index AFTER every Buefy re-render
//     (`isActive` change, scroll, resize) so the values Buefy writes back
//     cannot win specificity: the portal marker is restored via a
//     `MutationObserver` on the wrapper classList, and the z-index uses
//     `style.setProperty('z-index', z, 'important')`;
//   - restores the menu's previous inline z-index on close, and leaves
//     Buefy's mobile-modal presentation (fixed, centred, own z-index)
//     untouched;
//   - exports `resolveDropdownPlacement()` so callers choose inline,
//     `append-to-body` or in-place `position: fixed` from the clipping and
//     modal/drawer context;
//   - in the in-place fixed mode (a clipped menu inside a modal/drawer)
//     keeps the menu in its DOM and stacking context but pins it with
//     viewport coordinates so the scroll body cannot clip it; the inline
//     `position`/`top`/`left`/`right`/`bottom` values are restored on close;
//   - keeps its own scroll/resize listeners (capture phase, so they fire
//     before Buefy's) and removes them on close/unmount together with any
//     pending rAF callback;
//   - does NOT call Buefy private methods (`updateAppendToBody`,
//     `clickedOutside`, `keyPress`, mobile-modal handlers, focus-trap
//     directive) and does not replace any of Buefy's own listeners.
//
// SSR-safe: this module does not touch `window`/`document` at import time.
// All DOM access happens inside lifecycle hooks with paired cleanup.

import { nextTick, onBeforeUnmount, toValue, watch } from "vue";

// Marker on the menu itself (inline AND portal). One source of truth so the
// `@iam3xtr/ui` theme can style both forms through a single selector.
export const DROPDOWN_OVERLAY_MARKER = "tr-dropdown-overlay";

// Marker on the body-portal wrapper, so the theme can distinguish a portal
// from an inline menu (different width strategy, content-gutter behaviour,
// clipping-ancestor reaction). Survives Buefy's classList wipe via a
// `MutationObserver` re-applied on each open.
const PORTAL_MARKER = "tr-dropdown-overlay-portal";

// The four Buefy positions. The composable writes the chosen one back into
// `positionRef`; the caller binds that ref to `b-dropdown`'s `position` prop
// and Buefy reacts with a class swap.
export const POSITIONS = /** @type {const} */ ([
  "is-bottom-left",
  "is-bottom-right",
  "is-top-left",
  "is-top-right",
]);

const isBottom = (pos) => pos === "is-bottom-left" || pos === "is-bottom-right";

// Flip vertical (-bottom-* ↔ -top-*); horizontal side is preserved so a
// `is-bottom-right` flips to `is-top-right`, not `is-top-left`.
const flipVertical = (pos) =>
  isBottom(pos) ? pos.replace("is-bottom-", "is-top-") : pos.replace("is-top-", "is-bottom-");

// Z-index fallback matching the `tokens.scss` `--tr-z-dropdown` literal
// when the CSS custom property has not yet been computed (theme not yet
// applied, SSR, etc.).
const FALLBACK_Z = 35;

// `getComputedStyle` is a `window` global in browsers; access it through
// `window` so the composable keeps working in jsdom-style sandboxes that
// only expose it on `window`, not on the bare global.
const getComputedStyleFn = () =>
  (typeof window !== "undefined" && window.getComputedStyle)
  || (typeof globalThis !== "undefined" && globalThis.getComputedStyle)
  || null;

const readZ = () => {
  if (typeof document === "undefined") return FALLBACK_Z;
  const gcs = getComputedStyleFn();
  if (!gcs) return FALLBACK_Z;
  const raw = gcs(document.documentElement)
    .getPropertyValue("--tr-z-dropdown")
    .trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : FALLBACK_Z;
};

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

const VIEWPORT_EDGE_GAP = 8;

const spaceBelow = (rect) =>
  (typeof window !== "undefined" ? window.innerHeight : 0) - rect.bottom;
const spaceAbove = (rect) => rect.top;

// Ancestors that own their own stacking context above the page (`b-modal`,
// `b-sidebar`, another open dropdown menu, any ARIA dialog). A menu opened
// inside one of them never moves to a body portal: a portal at the
// `--tr-z-dropdown` token would render underneath the modal/drawer, Buefy's
// raw `99` would render above it, and a click inside a portal counts as an
// outside click for `b-sidebar`. When an ancestor clips overflow there
// (`.modal-card-body`, a drawer's scroll body) the menu stays in place and
// is pinned with `position: fixed` instead, which escapes overflow clipping
// while keeping the host's DOM, stacking context and focus handling.
const OVERLAY_CONTEXT_SELECTOR = ".modal, .sidebar-content, .dropdown-menu, [role='dialog']";
const CLIPPING_OVERFLOW = /\b(hidden|clip|auto|scroll)\b/;
const CLIPPING_CONTAIN = /\b(paint|strict|content)\b/;

/**
 * Chooses how a `b-dropdown` anchored at `anchor` should render its menu.
 *
 * - `"inline"` when no ancestor clips overflow (`overflow` other than
 *   `visible`, or `contain: paint`);
 * - `"fixed"` when the anchor sits inside a modal/drawer/dropdown/dialog
 *   and an ancestor up to and including that host clips overflow: the
 *   caller keeps `b-dropdown` inline and passes `fixed` to
 *   `useDropdownOverlay`, which pins the menu with viewport coordinates
 *   inside the host's stacking context;
 * - `"portal"` when an ancestor outside any such host clips overflow, so
 *   the caller should render `b-dropdown` with `append-to-body`.
 *
 * Returns `"inline"` without a DOM (SSR) or without an anchor. Buefy only
 * creates its body wrapper in `mounted()`, so callers resolve this once
 * the anchor is in the document and remount `b-dropdown` when it changes.
 *
 * @param {Element|null|undefined} anchor — the `b-dropdown` root element.
 * @returns {"inline"|"fixed"|"portal"}
 */
export function resolveDropdownPlacement(anchor) {
  if (!anchor || typeof document === "undefined") return "inline";
  const gcs = getComputedStyleFn();
  let clipped = false;
  for (
    let el = anchor.parentElement;
    el && el !== document.body && el !== document.documentElement;
    el = el.parentElement
  ) {
    if (!clipped && gcs) {
      const style = gcs(el);
      const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
      if (CLIPPING_OVERFLOW.test(overflow) || CLIPPING_CONTAIN.test(style.contain || "")) {
        clipped = true;
      }
    }
    if (el.matches?.(OVERLAY_CONTEXT_SELECTOR)) return clipped ? "fixed" : "inline";
  }
  return clipped ? "portal" : "inline";
}

// Buefy's mobile-modal presentation (`is-mobile-modal` below its mobile
// breakpoint) pins the menu with `position: fixed !important` and its own
// `z-index: 50 !important` above the `.background` scrim. Flip, portal
// coordinates and the lowered z-index do not apply there: an inline
// `!important` z-index would push the menu under its own scrim.
const isMobileModalPresentation = (menu) => {
  const gcs = getComputedStyleFn();
  if (!gcs || !menu) return false;
  return gcs(menu).position === "fixed";
};

/**
 * @typedef {Object} UseDropdownOverlayOptions
 * @property {import("vue").Ref<HTMLElement|null>} triggerRef — trigger button (or any anchor element). Used to measure its position relative to the viewport.
 * @property {import("vue").Ref<HTMLElement|null>} menuRef — `.dropdown-menu` Buefy renders. In portal mode Buefy moves it into a body wrapper; the caller is responsible for keeping this ref current (see `MobileFilters.vue` for the Buefy `$refs.dropdownMenu` lookup).
 * @property {import("vue").Ref<HTMLElement|null>} wrapperRef — `.dropdown` root Buefy renders. In inline mode this is the original root; in `append-to-body` mode this is the body-portal wrapper Buefy creates. The portal marker is installed on this element.
 * @property {import("vue").Ref<boolean>} activeRef — mirror of Buefy's `active-change` event. The composable reacts to its changes; the caller wires the event into the ref.
 * @property {import("vue").Ref<string>} positionRef — two-way binding to Buefy's `position` prop. Caller seeds it; composable writes the flipped value back so Buefy reactively re-renders the wrapper class.
 * @property {boolean|import("vue").Ref<boolean>|(() => boolean)} [appendToBody] — when true the composable also rewrites `top`/`left` (Buefy only writes them once on open) and lowers z-index via `!important` to the token scale (`--tr-z-dropdown`, below modal/drawer), so the portal cannot float above them; the menu's previous inline z-index is restored on close. Read on every open, so a caller can bind it to `resolveDropdownPlacement()`.
 * @property {boolean|import("vue").Ref<boolean>|(() => boolean)} [fixed] — inline mode only (ignored with `appendToBody`): when true the composable pins the menu in place with `position: fixed` and viewport `top`/`left` derived from the trigger, recomputed on scroll/resize, so a clipping scroll body of a modal/drawer cannot cut it off; the menu's previous inline positioning is restored on close. Read on every open, so a caller can bind it to `resolveDropdownPlacement() === "fixed"`.
 * @property {number} [edgeGap] — minimum free space to keep before flipping (px). Default 8.
 * @property {import("vue").Ref<HTMLElement|null>} [portalRef] — for body-portal mode: the outer body wrapper Buefy creates (`<div style="position:absolute">`). The composable can use it to find the menu by walking up from the portal wrapper when `menuRef` is not yet populated. Optional: when omitted, the composable relies on `menuRef` alone.
 */

/**
 * Connects auto-flip, portal marker and token-scaled z-index to an existing
 * `b-dropdown`. Does not call any private Buefy method and does not replace
 * Buefy's own Escape / outside-click / mobile-modal / focus-trap handlers.
 *
 * @param {UseDropdownOverlayOptions} options
 * @returns {{ reapply: () => void }}
 */
export function useDropdownOverlay(options) {
  const {
    triggerRef,
    menuRef,
    wrapperRef,
    activeRef,
    positionRef,
    appendToBody = false,
    fixed = false,
    edgeGap = VIEWPORT_EDGE_GAP,
    portalRef,
  } = options;

  // The menu's inline `z-index` before the first override of this open
  // (Buefy's literal `"99"` from `updateAppendToBody`), restored on close.
  // `null` while nothing has been overridden.
  let savedZIndex = null;
  // The menu's inline positioning before the fixed mode took it over,
  // restored on close. `null` while the fixed mode is not applied.
  let savedFixedStyle = null;
  let detachFns = [];
  let cancelFrame = null;
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

  const measure = () => {
    const trigger = triggerRef.value;
    const menu = menuRef.value;
    if (!trigger || !menu) return null;
    return {
      triggerRect: trigger.getBoundingClientRect(),
      menuRect: menu.getBoundingClientRect(),
    };
  };

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

  const applyPortalMarker = () => {
    const wrapper = wrapperRef.value;
    if (!wrapper) return;
    if (!wrapper.classList.contains(PORTAL_MARKER)) {
      wrapper.classList.add(PORTAL_MARKER);
    }
  };

  const applyMenuMarker = () => {
    const menu = menuRef.value;
    if (!menu) return;
    if (!menu.classList.contains(DROPDOWN_OVERLAY_MARKER)) {
      menu.classList.add(DROPDOWN_OVERLAY_MARKER);
    }
  };

  const removeMenuMarker = () => {
    const menu = menuRef.value;
    if (!menu) return;
    if (menu.classList.contains(DROPDOWN_OVERLAY_MARKER)) {
      menu.classList.remove(DROPDOWN_OVERLAY_MARKER);
    }
  };

  const removePortalMarkerOnce = () => {
    const wrapper = wrapperRef.value;
    if (!wrapper) return;
    if (wrapper.classList.contains(PORTAL_MARKER)) {
      wrapper.classList.remove(PORTAL_MARKER);
    }
  };

  // Buefy's mobile-modal CSS forces `position: fixed !important`. While
  // the in-place fixed mode owns an inline `position: fixed`, the computed
  // value alone cannot tell the two apart, so the owned inline value is
  // lifted for the read and put back unchanged.
  const isMobileModal = (menu) => {
    if (!savedFixedStyle || !menu) return isMobileModalPresentation(menu);
    const value = menu.style.getPropertyValue("position");
    const priority = menu.style.getPropertyPriority("position");
    menu.style.removeProperty("position");
    const result = isMobileModalPresentation(menu);
    if (value) menu.style.setProperty("position", value, priority);
    return result;
  };

  // Apply token-scaled z-index with `!important` so Buefy's later
  // `style.setProperty('z-index', '99')` calls in `updateAppendToBody`
  // (re-fired on every `isActive` change) cannot re-override us. The third
  // argument to `setProperty` is the priority; only inline `!important` can
  // beat inline `!important`, which Buefy never uses.
  const applyZIndex = () => {
    const menu = menuRef.value;
    if (!menu) return;
    if (isMobileModal(menu)) {
      restoreZIndex();
      return;
    }
    const z = String(readZ());
    if (savedZIndex === null) {
      savedZIndex = {
        value: menu.style.getPropertyValue("z-index"),
        priority: menu.style.getPropertyPriority("z-index"),
      };
    }
    if (
      menu.style.getPropertyValue("z-index") !== z
      || menu.style.getPropertyPriority("z-index") !== "important"
    ) {
      menu.style.setProperty("z-index", z, "important");
    }
  };

  const restoreZIndex = () => {
    const menu = menuRef.value;
    if (!menu || savedZIndex === null) return;
    if (savedZIndex.value) {
      menu.style.setProperty("z-index", savedZIndex.value, savedZIndex.priority);
    } else {
      menu.style.removeProperty("z-index");
    }
    savedZIndex = null;
  };

  const FIXED_PROPS = ["position", "top", "left", "right", "bottom", "width"];

  const restoreFixed = () => {
    const menu = menuRef.value;
    if (!menu || savedFixedStyle === null) return;
    for (const prop of FIXED_PROPS) {
      const saved = savedFixedStyle[prop];
      if (saved.value) {
        menu.style.setProperty(prop, saved.value, saved.priority);
      } else {
        menu.style.removeProperty(prop);
      }
    }
    savedFixedStyle = null;
  };

  // Viewport-relative menu origin for the current position, matching
  // Buefy's own `updateAppendToBody` formula (see `applyPortalCoords`).
  const menuOrigin = (menu, trigger) => {
    const rect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuH = menuRect.height || 0;
    const menuW = menuRect.width || 0;
    const triggerH = trigger.offsetHeight || 0;
    const triggerW = trigger.offsetWidth || 0;
    const position = positionRef.value;
    let top = rect.top;
    let left = rect.left;
    if (isBottom(position)) {
      top += triggerH;
    } else {
      top -= menuH;
    }
    if (position.endsWith("-left")) {
      left -= menuW - triggerW;
    }
    return { top, left };
  };

  // In-place fixed mode: `position: fixed` escapes the overflow clipping
  // of the modal/drawer scroll body while the menu stays in the host's DOM
  // and stacking context. `right`/`bottom` are reset so Bulma/Buefy
  // `is-*-left` / `is-top-*` offsets do not stretch the fixed box. An
  // `expanded` dropdown's `width: 100%` would resolve against the viewport
  // once fixed, so it is pinned to the dropdown root's width, as Buefy
  // does for its own `append-to-body` + `expanded` menu.
  const applyFixedCoords = () => {
    const menu = menuRef.value;
    const trigger = triggerRef.value;
    if (!menu || !trigger) return;
    if (savedFixedStyle === null) {
      savedFixedStyle = {};
      for (const prop of FIXED_PROPS) {
        savedFixedStyle[prop] = {
          value: menu.style.getPropertyValue(prop),
          priority: menu.style.getPropertyPriority(prop),
        };
      }
    }
    menu.style.setProperty("position", "fixed");
    menu.style.setProperty("right", "auto");
    menu.style.setProperty("bottom", "auto");
    const root = menu.parentElement;
    if (root?.classList?.contains("is-expanded") && root.offsetWidth) {
      menu.style.setProperty("width", `${root.offsetWidth}px`);
    }
    const { top, left } = menuOrigin(menu, trigger);
    menu.style.setProperty("top", `${top}px`);
    menu.style.setProperty("left", `${left}px`);
  };

  // Recompute inline `top`/`left` for body-portal mode. Buefy's
  // `updateAppendToBody` only writes these once per open and does not track
  // scroll/resize, so we re-derive from the trigger's bounding rect every
  // time the user scrolls or resizes. Horizontal alignment matches Buefy's
  // own `updateAppendToBody` formula exactly: in `*-right` positions the
  // menu's left edge sits on the trigger's left edge (`left = rect.left`);
  // in `*-left` positions the menu extends to the LEFT of the trigger
  // (the menu's right edge stays on the trigger's right edge), so
  // `left = rect.left - (menuW - triggerW)`.
  const applyPortalCoords = () => {
    const menu = menuRef.value;
    const trigger = triggerRef.value;
    if (!menu || !trigger) return;
    const scrollX = typeof window !== "undefined" ? window.scrollX : 0;
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const origin = menuOrigin(menu, trigger);
    const top = origin.top + scrollY;
    const left = origin.left + scrollX;
    menu.style.setProperty("top", `${top}px`);
    menu.style.setProperty("left", `${left}px`);
  };

  // Idempotent re-apply after Buefy has finished its own `isActive` work
  // (one watcher flush + one `$nextTick`). This is the central hook: every
  // entry point that may race with `updateAppendToBody` (`activeRef` flips,
  // scroll, resize) routes through here.
  //
  // `applyNow` does the synchronous work; scroll/resize frames call it
  // directly because nothing Buefy-side is pending then, so waiting for
  // extra ticks would only let the menu lag one frame behind the trigger.
  const applyNow = () => {
    const trigger = triggerRef.value;
    const menu = menuRef.value;
    if (!trigger || !menu) return;

    applyMenuMarker();
    const portal = !!toValue(appendToBody);
    const pinned = !portal && !!toValue(fixed);
    if (portal) {
      applyPortalMarker();
      applyZIndex();
    }
    // Buefy's mobile-modal presentation centres the fixed menu itself;
    // flipping or rewriting coordinates there would fight its CSS.
    if (isMobileModal(menu)) {
      restoreFixed();
      return;
    }

    const position = positionRef.value;
    const m = measure();
    const target = decide(position, m);
    if (target !== position) {
      positionRef.value = target;
    }

    if (portal) applyPortalCoords();
    else if (pinned) applyFixedCoords();
  };

  const apply = async () => {
    // Wait for Buefy to finish mounting/repositioning. Buefy's `isActive`
    // watcher calls `updateAppendToBody` inside `$nextTick`, so two flushes
    // cover the typical open-then-render sequence; for `appendToBody` we
    // also depend on the parent component's `refreshRefs` having populated
    // `menuRef`/`wrapperRef`, which is itself triggered by `active-change`.
    await nextTick();
    await nextTick();
    applyNow();
  };

  const attachListeners = () => {
    if (typeof window === "undefined" || listenersAttached) return;
    const onScrollOrResize = () => {
      if (cancelFrame) cancelFrame();
      cancelFrame = scheduleFrame(() => {
        cancelFrame = null;
        applyNow();
      });
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    detachFns.push(() => window.removeEventListener("scroll", onScrollOrResize, true));
    detachFns.push(() => window.removeEventListener("resize", onScrollOrResize));
    listenersAttached = true;
  };

  // Continuously re-install the portal marker + token-scaled z-index while
  // the menu is open. Buefy's `updateAppendToBody` rewrites both on every
  // `isActive` change and only runs `clickedOutside` / `keyPress` on the
  // document, so its handlers stay untouched. A rAF loop is the simplest
  // reactive strategy that does not depend on MutationObserver firing
  // through Buefy's `setProperty` path or on third-party timing — and it
  // covers the corner cases we know about: Buefy's `isActive` watcher
  // re-running after `selectItem`, after `appendToBodyCopyParent` clones,
  // and after any Buefy version-specific re-render we have not measured.
  let portalLoop = null;
  const startPortalLoop = () => {
    if (!toValue(appendToBody) || typeof window === "undefined" || portalLoop) return;
    const tick = () => {
      applyPortalMarker();
      applyMenuMarker();
      applyZIndex();
      portalLoop = window.requestAnimationFrame(tick);
    };
    portalLoop = window.requestAnimationFrame(tick);
    detachFns.push(() => {
      if (portalLoop) {
        window.cancelAnimationFrame(portalLoop);
        portalLoop = null;
      }
    });
  };

  const onOpen = async () => {
    // In portal mode Buefy needs one tick to mount the body wrapper and
    // move `.dropdown-menu` into it; the caller typically populates
    // `menuRef`/`wrapperRef` from its own `active-change` handler after
    // `nextTick`. We chain one more `nextTick` here to be safe across
    // call sites that populate refs synchronously vs. via a watcher.
    await nextTick();
    attachListeners();
    apply();
    startPortalLoop();
  };

  const onClose = () => {
    detachListeners();
    removeMenuMarker();
    restoreZIndex();
    restoreFixed();
    removePortalMarkerOnce();
  };

  // `flush: 'post'` runs the handler AFTER all other watchers in the same
  // flush — including Buefy's `isActive` watcher — but Buefy defers its
  // actual `updateAppendToBody` call inside `$nextTick`, so `apply()`
  // itself does a 2× nextTick wait before writing.
  watch(activeRef, (isActive) => {
    if (isActive) {
      onOpen();
    } else {
      onClose();
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    onClose();
  });

  return {
    reapply: () => apply(),
  };
}