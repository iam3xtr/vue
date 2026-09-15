import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import Buefy from "buefy";

import CopyPre from "../src/components/CopyPre.vue";

describe("CopyPre", () => {
  it("displays text when no slot content is given", () => {
    const wrapper = mount(CopyPre, { props: { text: "hello" }, global: { plugins: [Buefy] } });
    expect(wrapper.find(".copy-pre__pre").text()).toBe("hello");
  });

  it("is disabled with empty text and cannot copy", async () => {
    const wrapper = mount(CopyPre, { props: { text: "" }, global: { plugins: [Buefy] } });
    const button = wrapper.find("button");
    expect(button.attributes("disabled")).toBeDefined();
  });

  it("copies text to the clipboard and shows the copied state, then reverts after 2s", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const wrapper = mount(CopyPre, {
      props: { text: "secret", buttonLabel: "Copy", copiedLabel: "Copied!" },
      global: { plugins: [Buefy] },
    });

    await wrapper.find("button").trigger("click");
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("secret"));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".is-sr-only").text()).toBe("Copied!");

    vi.advanceTimersByTime(2000);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".is-sr-only").text()).toBe("Copy");

    vi.useRealTimers();
  });

  it("clears its copied-state timer on unmount (no post-unmount state change)", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const wrapper = mount(CopyPre, { props: { text: "x" }, global: { plugins: [Buefy] } });
    await wrapper.find("button").trigger("click");
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());

    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    wrapper.unmount();
    expect(clearSpy).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
