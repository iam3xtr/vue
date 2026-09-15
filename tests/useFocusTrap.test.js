import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";

import { useFocusTrap } from "../src/composables/useFocusTrap.js";

const Harness = defineComponent({
  props: { active: Boolean },
  setup(props) {
    const container = ref(null);
    const active = ref(props.active);
    useFocusTrap(container, active);
    return { container, active };
  },
  render() {
    return h("div", [
      h("button", { class: "trigger" }, "Trigger"),
      h("div", { ref: "container" }, [
        h("button", { class: "first" }, "First"),
        h("button", { class: "last" }, "Last"),
      ]),
    ]);
  },
});

describe("useFocusTrap", () => {
  it("moves focus to the first focusable element once activated, and returns it to the trigger on close", async () => {
    const wrapper = mount(Harness, { props: { active: false }, attachTo: document.body });
    const trigger = wrapper.find(".trigger").element;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    wrapper.vm.active = true;
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(wrapper.find(".first").element);

    wrapper.vm.active = false;
    await nextTick();
    expect(document.activeElement).toBe(trigger);

    wrapper.unmount();
  });

  it("traps Tab within the container while active", async () => {
    const wrapper = mount(Harness, { props: { active: false }, attachTo: document.body });
    wrapper.vm.active = true;
    await nextTick();
    await nextTick();

    const last = wrapper.find(".last").element;
    last.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(document.activeElement).toBe(wrapper.find(".first").element);

    wrapper.unmount();
  });

  it("removes its document keydown listener on unmount", () => {
    const removeSpy = vi.fn();
    const original = document.removeEventListener;
    document.removeEventListener = removeSpy;
    const wrapper = mount(Harness, { props: { active: true } });
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    document.removeEventListener = original;
  });
});
