import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";

import {
  POSITIONS,
  useDropdownOverlay,
  DROPDOWN_OVERLAY_MARKER,
} from "../src/composables/useDropdownOverlay.js";

// ------------------------------------------------------------------
// Test helpers
// ------------------------------------------------------------------

// jsdom does not compute layout, so `getBoundingClientRect()` returns
// zeros by default. We override the method per-element, and use
// `Object.defineProperty` for `offsetHeight` because jsdom 30 ships
// that property as a read-only getter.
const setRect = (el, rect) => {
  el.getBoundingClientRect = () => ({
    x: rect.x ?? 0,
    y: rect.y ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    top: rect.top ?? rect.y ?? 0,
    left: rect.left ?? rect.x ?? 0,
    right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 0),
    bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 0),
  });
  Object.defineProperty(el, "offsetHeight", {
    value: rect.offsetHeight ?? rect.height ?? 0,
    configurable: true,
  });
  Object.defineProperty(el, "offsetWidth", {
    value: rect.offsetWidth ?? rect.width ?? 0,
    configurable: true,
  });
};

const flushMicro = () => new Promise((r) => setTimeout(r, 0));
const flushFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

// Builds a harness that mounts a synthetic `.dropdown` (the Buefy
// shape we depend on) and routes the four element refs to a fresh
// composition tree. The harness itself owns the refs so tests can
// override rects and assert on the resulting position class.
function makeHarness({ appendToBody = false } = {}) {
  const refs = {
    wrapperRef: ref(null),
    triggerRef: ref(null),
    menuRef: ref(null),
    activeRef: ref(false),
    positionRef: ref("is-bottom-left"),
  };

  const Harness = defineComponent({
    setup() {
      useDropdownOverlay({
        triggerRef: refs.triggerRef,
        menuRef: refs.menuRef,
        wrapperRef: refs.wrapperRef,
        activeRef: refs.activeRef,
        positionRef: refs.positionRef,
        appendToBody,
      });
      return () =>
        h("div", { ref: refs.wrapperRef, class: "dropdown" }, [
          h("button", { ref: refs.triggerRef, class: "dropdown-trigger" }, "Open"),
          h("div", { ref: refs.menuRef, class: "dropdown-menu" }, [
            h("div", { class: "dropdown-content" }, [
              h("a", { class: "dropdown-item" }, "Item"),
            ]),
          ]),
        ]);
    },
  });

  return { Harness, refs };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("useDropdownOverlay", () => {
  let wrapper;
  let refs;
  let Harness;
  let originalInnerHeight;

  beforeEach(() => {
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      writable: true,
      configurable: true,
    });
    document.documentElement.style.setProperty("--tr-z-dropdown", "35");
  });

  afterEach(() => {
    wrapper?.unmount();
    Object.defineProperty(window, "innerHeight", {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  function mountFresh({ appendToBody = false } = {}) {
    ({ Harness, refs } = makeHarness({ appendToBody }));
    wrapper = mount(Harness);
    return { wrapper, refs };
  }

  it("exposes the documented contract from the package entrypoint", () => {
    expect(typeof useDropdownOverlay).toBe("function");
    expect(DROPDOWN_OVERLAY_MARKER).toBe("tr-dropdown-overlay");
    expect(POSITIONS).toEqual([
      "is-bottom-left",
      "is-bottom-right",
      "is-top-left",
      "is-top-right",
    ]);
  });

  it("keeps the original position when the menu fits below the trigger", async () => {
    ({ refs } = mountFresh());
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    refs.positionRef.value = "is-bottom-left";
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    expect(refs.positionRef.value).toBe("is-bottom-left");
  });

  it("flips is-bottom-left to is-top-left when space below is too small", async () => {
    ({ refs } = mountFresh());
    setRect(refs.triggerRef.value, { top: 720, bottom: 750, height: 30 });
    setRect(refs.menuRef.value, { height: 200 });
    refs.positionRef.value = "is-bottom-left";
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    expect(refs.positionRef.value).toBe("is-top-left");
  });

  it("flips is-top-right to is-bottom-right when space above is too small", async () => {
    ({ refs } = mountFresh());
    setRect(refs.triggerRef.value, { top: 5, bottom: 35, height: 30 });
    setRect(refs.menuRef.value, { height: 300 });
    refs.positionRef.value = "is-top-right";
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    expect(refs.positionRef.value).toBe("is-bottom-right");
  });

  it("leaves the position alone when neither direction has enough space (no over-promise)", async () => {
    ({ refs } = mountFresh());
    setRect(refs.triggerRef.value, { top: 400, bottom: 430, height: 30 });
    setRect(refs.menuRef.value, { height: 1000 });
    refs.positionRef.value = "is-bottom-left";
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    expect(refs.positionRef.value).toBe("is-bottom-left");
  });

  it("adds the marker class to the menu on open and removes it on close", async () => {
    ({ refs } = mountFresh());
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    expect(refs.menuRef.value.classList.contains(DROPDOWN_OVERLAY_MARKER)).toBe(true);
    refs.activeRef.value = false;
    await nextTick();
    expect(refs.menuRef.value.classList.contains(DROPDOWN_OVERLAY_MARKER)).toBe(false);
  });

  it("adds the portal marker and overrides z-index in append-to-body mode", async () => {
    ({ refs } = mountFresh({ appendToBody: true }));
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    refs.menuRef.value.style.setProperty("z-index", "99");
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    expect(refs.wrapperRef.value.classList.contains("tr-dropdown-overlay-portal")).toBe(true);
    expect(refs.menuRef.value.style.getPropertyValue("z-index")).toBe("35");
  });

  it("restores the original z-index on close", async () => {
    ({ refs } = mountFresh({ appendToBody: true }));
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    refs.menuRef.value.style.setProperty("z-index", "99");
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    expect(refs.menuRef.value.style.getPropertyValue("z-index")).toBe("35");
    refs.activeRef.value = false;
    await nextTick();
    expect(refs.menuRef.value.style.getPropertyValue("z-index")).toBe("99");
  });

  it("falls back to a known z-index when the CSS variable is missing", async () => {
    document.documentElement.style.removeProperty("--tr-z-dropdown");
    ({ refs } = mountFresh({ appendToBody: true }));
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    expect(refs.menuRef.value.style.getPropertyValue("z-index")).toBe("35");
  });

  it("detaches its own scroll/resize listeners on close", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    ({ refs } = mountFresh());
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    const added = addSpy.mock.calls.filter(
      ([type]) => type === "scroll" || type === "resize",
    ).length;
    expect(added).toBeGreaterThan(0);
    refs.activeRef.value = false;
    await nextTick();
    const removed = removeSpy.mock.calls.filter(
      ([type]) => type === "scroll" || type === "resize",
    ).length;
    expect(removed).toBeGreaterThanOrEqual(added);
  });

  it("recomputes the position when a scroll event arrives after opening", async () => {
    ({ refs } = mountFresh());
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    expect(refs.positionRef.value).toBe("is-bottom-left");
    // Trigger now sits against the lower viewport edge after a scroll.
    setRect(refs.triggerRef.value, { top: 720, bottom: 750, height: 30 });
    window.dispatchEvent(new Event("scroll"));
    await flushFrame();
    expect(refs.positionRef.value).toBe("is-top-left");
  });

  it("does not call Buefy private methods or replace its DOM hooks", async () => {
    ({ refs } = mountFresh());
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    const addSpy = vi.spyOn(document, "addEventListener");
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    const documentAdds = addSpy.mock.calls.map(([type]) => type);
    expect(documentAdds).not.toContain("click");
    expect(documentAdds).not.toContain("keyup");
  });

  it("restores the portal marker when Buefy wipes the wrapper classList", async () => {
    ({ refs } = mountFresh({ appendToBody: true }));
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    // Simulate Buefy's updateAppendToBody wiping the classList (it removes
    // all classes and re-adds its own before applying the next position).
    refs.wrapperRef.value.classList.remove("tr-dropdown-overlay-portal");
    await nextTick();
    expect(refs.wrapperRef.value.classList.contains("tr-dropdown-overlay-portal")).toBe(true);
  });

  it("keeps the lowered z-index when Buefy rewrites the menu style", async () => {
    ({ refs } = mountFresh({ appendToBody: true }));
    setRect(refs.triggerRef.value, { top: 100, bottom: 130, height: 30 });
    setRect(refs.menuRef.value, { height: 120 });
    refs.menuRef.value.style.setProperty("z-index", "99");
    refs.activeRef.value = true;
    await nextTick();
    await flushMicro();
    // Buefy's updateAppendToBody later overwrites the menu style.
    refs.menuRef.value.style.setProperty("z-index", "99");
    window.dispatchEvent(new Event("scroll"));
    await flushFrame();
    // The !important-priority write from the composable must win.
    expect(refs.menuRef.value.style.getPropertyValue("z-index")).toBe("35");
  });
});