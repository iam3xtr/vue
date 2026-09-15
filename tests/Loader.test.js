import { describe, expect, it, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";

import Loader from "../src/components/Loader.vue";

function mockMatchMedia(matches) {
  const listeners = new Set();
  const mql = {
    matches,
    addEventListener: vi.fn((_, handler) => listeners.add(handler)),
    removeEventListener: vi.fn((_, handler) => listeners.delete(handler)),
  };
  window.matchMedia = vi.fn(() => mql);
  return mql;
}

describe("Loader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has an accessible status role/label and defaults to the section size", () => {
    mockMatchMedia(false);
    const wrapper = mount(Loader);
    expect(wrapper.attributes("role")).toBe("status");
    expect(wrapper.attributes("aria-live")).toBe("polite");
    expect(wrapper.attributes("aria-label")).toBe("Загрузка");
    expect(wrapper.classes()).toContain("tr-loader--section");
  });

  it("accepts a custom accessible label and size", () => {
    mockMatchMedia(false);
    const wrapper = mount(Loader, { props: { size: "screen", label: "Loading" } });
    expect(wrapper.attributes("aria-label")).toBe("Loading");
    expect(wrapper.classes()).toContain("tr-loader--screen");
  });

  it("rejects an invalid size prop value via its validator", () => {
    // eslint-disable-next-line no-console
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockMatchMedia(false);
    mount(Loader, { props: { size: "huge" } });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("swaps to the static mark under prefers-reduced-motion", async () => {
    mockMatchMedia(true);
    const wrapper = mount(Loader);
    // Reading `matchMedia` and flipping the ref both happen inside
    // `onMounted`, but the resulting re-render is scheduled, not
    // synchronous — a tick is needed before the DOM reflects it.
    await wrapper.vm.$nextTick();
    // The static mark ships with no <animate> element (see @iam3xtr/ui's
    // asset); the animated one does. (The static file's own explanatory
    // comment mentions "<animate>" as plain text, hence matching on the
    // real element's attribute rather than the bare tag name.)
    expect(wrapper.find(".tr-loader__mark").html()).not.toMatch(/<animate\s+attributeName/);
  });

  it("uses the animated mark by default (no reduced motion)", () => {
    mockMatchMedia(false);
    const wrapper = mount(Loader);
    expect(wrapper.find(".tr-loader__mark").html()).toMatch(/<animate\s+attributeName/);
  });

  it("registers and cleans up its matchMedia change listener on unmount", () => {
    const mql = mockMatchMedia(false);
    const wrapper = mount(Loader);
    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    expect(mql.removeEventListener).not.toHaveBeenCalled();
    wrapper.unmount();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
    // Same handler instance added is the one removed.
    expect(mql.removeEventListener.mock.calls[0][1]).toBe(mql.addEventListener.mock.calls[0][1]);
  });

  it("does not touch matchMedia when window is unavailable at setup", () => {
    // Simulates the SSR-safety guard: matchMedia is never called outside
    // onMounted, which does not run at all during a server render.
    const original = window.matchMedia;
    // @ts-expect-error test-only removal
    delete window.matchMedia;
    expect(() => mount(Loader)).not.toThrow();
    window.matchMedia = original;
  });
});
