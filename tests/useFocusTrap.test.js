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
    const wrapper = mount(Harness, {
      props: { active: false },
      attachTo: document.body,
    });
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
    const wrapper = mount(Harness, {
      props: { active: false },
      attachTo: document.body,
    });
    wrapper.vm.active = true;
    await nextTick();
    await nextTick();

    const last = wrapper.find(".last").element;
    last.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
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
    expect(removeSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
      true,
    );
    document.removeEventListener = original;
  });

  const makeHarness = (options = {}, empty = false) =>
    defineComponent({
      props: { active: Boolean },
      setup(props) {
        const container = ref(null);
        const active = ref(props.active);
        useFocusTrap(container, active, {
          ...options,
          getReturnFocusEl: options.getReturnFocusEl
            ? () => options.getReturnFocusEl()
            : undefined,
        });
        return { container, active };
      },
      render() {
        return h("div", [
          h("button", { class: "trigger" }, "Trigger"),
          h(
            "div",
            { ref: "container", tabindex: "-1", class: "box" },
            empty
              ? []
              : [
                  h("button", { class: "first" }, "First"),
                  h("button", { class: "last" }, "Last"),
                ],
          ),
        ]);
      },
    });

  it("immediate: focuses inside an initially-open container; without it nothing happens", async () => {
    const wrapper = mount(makeHarness({ immediate: true }), {
      props: { active: true },
      attachTo: document.body,
    });
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(wrapper.find(".first").element);
    wrapper.unmount();

    const plain = mount(makeHarness({}), {
      props: { active: true },
      attachTo: document.body,
    });
    await nextTick();
    await nextTick();
    expect(document.activeElement).not.toBe(plain.find(".first").element);
    plain.unmount();
  });

  it("contain: Tab from outside is pulled in, and Tab with no focusables stays on the container", async () => {
    const wrapper = mount(makeHarness({ contain: true }), {
      props: { active: false },
      attachTo: document.body,
    });
    wrapper.vm.active = true;
    await nextTick();
    await nextTick();
    wrapper.find(".trigger").element.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(wrapper.find(".first").element);
    wrapper.unmount();

    const empty = mount(makeHarness({ contain: true }, true), {
      props: { active: false },
      attachTo: document.body,
    });
    empty.vm.active = true;
    await nextTick();
    await nextTick();
    empty.find(".trigger").element.focus();
    const ev2 = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(empty.find(".box").element);
    empty.unmount();
  });

  it("skips a detached return-focus element without throwing or moving focus to it", async () => {
    const detached = document.createElement("button");
    const wrapper = mount(makeHarness({ getReturnFocusEl: () => detached }), {
      props: { active: false },
      attachTo: document.body,
    });
    const trigger = wrapper.find(".trigger").element;
    trigger.focus();
    wrapper.vm.active = true;
    await nextTick();
    await nextTick();
    const spy = vi.spyOn(detached, "focus");
    wrapper.vm.active = false;
    await nextTick();
    expect(spy).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(detached);
    wrapper.unmount();
  });

  it("contain: does not steal Tab, Shift+Tab or Escape from a stacked overlay outside the container", async () => {
    for (const empty of [false, true]) {
      const wrapper = mount(makeHarness({ contain: true }, empty), {
        props: { active: false },
        attachTo: document.body,
      });
      wrapper.vm.active = true;
      await nextTick();
      await nextTick();

      const modal = document.createElement("div");
      modal.className = "modal is-active";
      modal.innerHTML =
        '<button class="m-cancel">Cancel</button><button class="m-ok">OK</button>';
      document.body.appendChild(modal);
      const cancel = modal.querySelector(".m-cancel");
      cancel.focus();

      for (const init of [
        { key: "Tab" },
        { key: "Tab", shiftKey: true },
        { key: "Escape" },
      ]) {
        const ev = new KeyboardEvent("keydown", {
          ...init,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(cancel);
      }

      // Plain outside focus (not in an overlay) is still pulled back in.
      wrapper.find(".trigger").element.focus();
      const ev = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);

      modal.remove();
      wrapper.unmount();
    }
  });
});
