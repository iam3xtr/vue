// Focus trap + focus return composable for overlay-style UI (e.g. a mobile
// nav menu). Buefy's `b-dropdown` (`mobile-modal`) already traps Tab via its
// own `trap-focus` directive and closes on Escape via its own `keyup`
// listener — what it does not do is return focus to the trigger element
// once the panel closes. Apply this composable only where that gap
// actually exists; a plain (non-modal) dropdown does not need it.
//
// Given a container ref and a boolean "active" ref, this composable:
//   - moves focus to the first focusable element inside the container when
//     `active` becomes true;
//   - traps Tab/Shift+Tab within the container's focusable elements while
//     `active` is true (redundant with a host's own trap where one exists,
//     but required standalone for containers without it);
//   - returns focus to the trigger element (or whatever had focus before
//     opening) when `active` becomes false.
//
// Deliberately does NOT close on Escape itself: `active` is a one-way
// mirror of the host overlay's own open state here, not a `v-model` the
// overlay reads back from. Closing locally on a capturing `keydown` can
// race a host's own Escape-close handled on a later bubbling event — focus
// would jump back to the trigger while the panel is still visually open.
// Letting the host own the close and reacting only to the real state change
// removes the race entirely.
//
// No runtime dependency beyond Vue 3 reactivity and DOM APIs.

import { nextTick, onMounted, onUnmounted, watch } from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Overlays that may legitimately stack above a trapped container (Buefy
// `b-modal`, native/ARIA dialogs). Focus inside one of them belongs to that
// overlay's own trap, so the container must not pull Tab back out of it.
const FOREIGN_OVERLAY_SELECTOR =
  ".modal, dialog[open], [role='dialog'], [role='alertdialog'], [aria-modal='true']";

/**
 * @param {import("vue").Ref<HTMLElement|null>} containerRef - element the trap is scoped to
 * @param {import("vue").Ref<boolean>} activeRef - mirrors the real open state (e.g. from a host's own `active-change`); this composable only reads it, never writes `false` back
 * @param {{ getReturnFocusEl?: () => (HTMLElement|null|undefined), immediate?: boolean, contain?: boolean }} [options]
 *   - `getReturnFocusEl`: element to refocus on close; falls back to the element focused before opening. A detached element is skipped.
 *   - `immediate`: also run the "activated" step when `activeRef` is already true on mount (initially-open overlay). Default `false`.
 *   - `contain`: strict mode for containers that must hold focus on their own. Tab with no focusable controls keeps focus on the
 *     container (give it `tabindex="-1"`), and Tab while focus is outside the container pulls it back in. Default `false`,
 *     which keeps the original behaviour for hosts that already trap focus themselves. Focus that sits inside a higher overlay
 *     (`.modal`, `dialog[open]`, `[role=dialog|alertdialog]`, `[aria-modal=true]`) outside the container is left alone, so a
 *     stacked confirmation keeps its own Tab handling.
 */
export function useFocusTrap(containerRef, activeRef, options = {}) {
  const { getReturnFocusEl, immediate = false, contain = false } = options;
  let previouslyFocused = null;
  let mounted = false;

  const getFocusable = () => {
    const container = containerRef.value;
    if (!container) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => !el.hasAttribute("disabled"),
    );
  };

  const focusFirst = () => {
    const [first] = getFocusable();
    if (first) first.focus();
    else containerRef.value?.focus();
  };

  const isInForeignOverlay = (el) => {
    const container = containerRef.value;
    if (!container || !el || container.contains(el) || !el.closest)
      return false;
    const overlay = el.closest(FOREIGN_OVERLAY_SELECTOR);
    // An overlay that wraps the container (e.g. the drawer's own dialog role) is not "higher".
    return !!overlay && !overlay.contains(container);
  };

  const handleKeydown = (event) => {
    if (!activeRef.value) return;

    // Escape is intentionally not handled here — see the module comment
    // above: the host overlay's own listener closes it, and this
    // composable reacts to that real close via the `watch` below.
    if (event.key !== "Tab") return;

    if (isInForeignOverlay(document.activeElement)) return;

    const focusable = getFocusable();
    if (!focusable.length) {
      if (contain && containerRef.value) {
        event.preventDefault();
        containerRef.value.focus();
      }
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (contain && !containerRef.value.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const activate = () => {
    previouslyFocused = document.activeElement;
    document.addEventListener("keydown", handleKeydown, true);
    nextTick(() => {
      if (mounted && activeRef.value) focusFirst();
    });
  };

  const deactivate = () => {
    document.removeEventListener("keydown", handleKeydown, true);
    const candidate =
      (typeof getReturnFocusEl === "function" ? getReturnFocusEl() : null) ??
      previouslyFocused;
    previouslyFocused = null;
    // A trigger removed from the DOM while the overlay was open cannot take focus.
    const returnEl =
      candidate && candidate.isConnected !== false ? candidate : null;
    if (returnEl && typeof returnEl.focus === "function") returnEl.focus();
  };

  watch(activeRef, (isActive) => {
    if (mounted) isActive ? activate() : deactivate();
  });

  // DOM activation belongs to the mounted client, never the SSR setup pass.
  onMounted(() => {
    mounted = true;
    if (immediate && activeRef.value) activate();
  });

  onUnmounted(() => {
    mounted = false;
    document.removeEventListener("keydown", handleKeydown, true);
  });
}
