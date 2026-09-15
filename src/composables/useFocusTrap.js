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

import { nextTick, onUnmounted, watch } from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * @param {import("vue").Ref<HTMLElement|null>} containerRef - element the trap is scoped to
 * @param {import("vue").Ref<boolean>} activeRef - mirrors the real open state (e.g. from a host's own `active-change`); this composable only reads it, never writes `false` back
 * @param {{ getReturnFocusEl?: () => (HTMLElement|null|undefined) }} [options] - element to refocus on close; falls back to the element focused before opening
 */
export function useFocusTrap(containerRef, activeRef, options = {}) {
  const { getReturnFocusEl } = options;
  let previouslyFocused = null;

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

  const handleKeydown = (event) => {
    if (!activeRef.value) return;

    // Escape is intentionally not handled here — see the module comment
    // above: the host overlay's own listener closes it, and this
    // composable reacts to that real close via the `watch` below.
    if (event.key !== "Tab") return;

    const focusable = getFocusable();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  watch(activeRef, (isActive) => {
    if (isActive) {
      previouslyFocused = document.activeElement;
      document.addEventListener("keydown", handleKeydown, true);
      nextTick(focusFirst);
    } else {
      document.removeEventListener("keydown", handleKeydown, true);
      const returnEl =
        (typeof getReturnFocusEl === "function" ? getReturnFocusEl() : null) ??
        previouslyFocused;
      previouslyFocused = null;
      if (returnEl && typeof returnEl.focus === "function") returnEl.focus();
    }
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown, true);
  });
}
