import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import Buefy from "buefy";

import FormDrawer from "../src/components/FormDrawer.vue";

function mountDrawer(options = {}) {
  return mount(FormDrawer, {
    global: { plugins: [Buefy] },
    ...options,
  });
}

describe("FormDrawer", () => {
  it("renders the title and a body/footer with slot content", () => {
    const wrapper = mountDrawer({
      props: { modelValue: true, title: "Add member" },
      slots: { default: "<p>Body</p>", footer: "<button>Save</button>" },
    });
    expect(wrapper.find(".tr-form-drawer__title").text()).toBe("Add member");
    expect(wrapper.find(".tr-form-drawer__body").text()).toBe("Body");
    expect(wrapper.find(".tr-form-drawer__footer").text()).toContain("Save");
  });

  it("omits the footer region entirely when no footer slot content is given", () => {
    const wrapper = mountDrawer({ props: { modelValue: true } });
    expect(wrapper.find(".tr-form-drawer__footer").exists()).toBe(false);
  });

  it("omits the title element when no title prop is given", () => {
    const wrapper = mountDrawer({ props: { modelValue: true } });
    expect(wrapper.find(".tr-form-drawer__title").exists()).toBe(false);
  });

  it("uses b-sidebar right/overlay/fullheight instead of a custom overlay", () => {
    const wrapper = mountDrawer({ props: { modelValue: true } });
    const sidebar = wrapper.findComponent({ name: "BSidebar" });
    expect(sidebar.exists()).toBe(true);
    expect(sidebar.props("right")).toBe(true);
    expect(sidebar.props("overlay")).toBe(true);
    expect(sidebar.props("fullheight")).toBe(true);
  });

  it("emits update:modelValue(false) from the header close button", async () => {
    const wrapper = mountDrawer({ props: { modelValue: true } });
    await wrapper.find(".tr-form-drawer__close").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
  });

  it("gives the close button an accessible name, overridable for localization", () => {
    const wrapper = mountDrawer({ props: { modelValue: true } });
    expect(wrapper.find(".tr-form-drawer__close").attributes("aria-label")).toBe("Закрыть");

    const custom = mountDrawer({
      props: { modelValue: true, closeAriaLabel: "Close" },
    });
    expect(custom.find(".tr-form-drawer__close").attributes("aria-label")).toBe("Close");
  });

  it("emits submit exactly once on native form submit", async () => {
    const wrapper = mountDrawer({ props: { modelValue: true } });
    await wrapper.find(".tr-form-drawer__form").trigger("submit");
    expect(wrapper.emitted("submit")).toHaveLength(1);
  });

  it("does not emit submit while busy", async () => {
    const wrapper = mountDrawer({ props: { modelValue: true, busy: true } });
    await wrapper.find(".tr-form-drawer__form").trigger("submit");
    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("does not emit submit while disabled", async () => {
    const wrapper = mountDrawer({ props: { modelValue: true, disabled: true } });
    await wrapper.find(".tr-form-drawer__form").trigger("submit");
    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("exposes busy/disabled as scoped slot props to default and footer slots", () => {
    const wrapper = mountDrawer({
      props: { modelValue: true, busy: true, disabled: false },
      slots: {
        default: `<template #default="{ busy, disabled }"><span class="body-state">{{ busy }}:{{ disabled }}</span></template>`,
        footer: `<template #footer="{ busy, disabled }"><button class="footer-btn" :disabled="busy || disabled">Save</button></template>`,
      },
    });
    expect(wrapper.find(".body-state").text()).toBe("true:false");
    expect(wrapper.find(".footer-btn").attributes("disabled")).toBeDefined();
  });

  describe("close guard", () => {
    const wrappers = [];
    function mountGuarded(props = {}) {
      const wrapper = mountDrawer({ props: { modelValue: true, ...props } });
      wrappers.push(wrapper);
      return wrapper;
    }
    afterEach(() => {
      wrappers.splice(0).forEach((w) => w.unmount());
    });

    const escape = () => document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));
    const backdrop = () => {
      const el = document.body.querySelector(".sidebar-background");
      expect(el).not.toBeNull();
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    };
    const button = (w) => w.find(".tr-form-drawer__close").trigger("click");
    const deferred = () => {
      let resolve, reject;
      const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
      return { promise, resolve, reject };
    };
    const triggers = {
      escape: [() => escape(), "escape"],
      backdrop: [() => backdrop(), "backdrop"],
      "close-button": [(w) => button(w), "close-button"],
    };

    it.each(Object.keys(triggers))("closes without a guard via %s", async (name) => {
      const w = mountGuarded();
      await triggers[name][0](w);
      await flushPromises();
      expect(w.emitted("update:modelValue")).toEqual([[false]]);
    });

    it.each(Object.keys(triggers))("passes the reason and closes once when %s is allowed", async (name) => {
      const beforeClose = vi.fn().mockResolvedValue(true);
      const w = mountGuarded({ beforeClose });
      await triggers[name][0](w);
      await flushPromises();
      expect(beforeClose).toHaveBeenCalledTimes(1);
      expect(beforeClose).toHaveBeenCalledWith(triggers[name][1]);
      expect(w.emitted("update:modelValue")).toEqual([[false]]);
    });

    it.each(Object.keys(triggers))("keeps the panel open when %s is denied", async (name) => {
      const w = mountGuarded({ beforeClose: () => Promise.resolve(false) });
      await triggers[name][0](w);
      await flushPromises();
      expect(w.emitted("update:modelValue")).toBeUndefined();
      expect(w.findComponent({ name: "BSidebar" }).vm.isOpen).toBe(true);
    });

    it("treats a rejection or a synchronous throw as denial", async () => {
      const rejecting = mountGuarded({ beforeClose: () => Promise.reject(new Error("x")) });
      await button(rejecting);
      await flushPromises();
      expect(rejecting.emitted("update:modelValue")).toBeUndefined();

      const throwing = mountGuarded({
        beforeClose: () => {
          throw new Error("x");
        },
      });
      await button(throwing);
      await flushPromises();
      expect(throwing.emitted("update:modelValue")).toBeUndefined();
    });

    it("does not hide the sidebar while the guard is pending", async () => {
      const d = deferred();
      const w = mountGuarded({ beforeClose: () => d.promise });
      escape();
      await flushPromises();
      expect(w.findComponent({ name: "BSidebar" }).vm.isOpen).toBe(true);
      expect(w.emitted("update:modelValue")).toBeUndefined();
      d.resolve(true);
      await flushPromises();
      expect(w.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("runs a pending guard only once across all close reasons", async () => {
      const d = deferred();
      const beforeClose = vi.fn(() => d.promise);
      const w = mountGuarded({ beforeClose });
      escape();
      backdrop();
      await button(w);
      escape();
      expect(beforeClose).toHaveBeenCalledTimes(1);
      d.resolve(true);
      await flushPromises();
      expect(w.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("allows a new request after a denial", async () => {
      const beforeClose = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const w = mountGuarded({ beforeClose });
      await button(w);
      await flushPromises();
      await button(w);
      await flushPromises();
      expect(beforeClose).toHaveBeenCalledTimes(2);
      expect(w.emitted("update:modelValue")).toEqual([[false]]);
    });

    it("discards a stale result after an external close", async () => {
      const d = deferred();
      const w = mountGuarded({ beforeClose: () => d.promise });
      await button(w);
      await w.setProps({ modelValue: false });
      d.resolve(true);
      await flushPromises();
      expect(w.emitted("update:modelValue")).toBeUndefined();
    });

    it("does not close a reopened form from an earlier guard", async () => {
      const first = deferred();
      const second = deferred();
      const beforeClose = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const w = mountGuarded({ beforeClose });
      await button(w);
      await w.setProps({ modelValue: false });
      await w.setProps({ modelValue: true });
      first.resolve(true);
      await flushPromises();
      expect(w.emitted("update:modelValue")).toBeUndefined();
      await button(w);
      expect(beforeClose).toHaveBeenCalledTimes(2);
      second.resolve(false);
      await flushPromises();
      expect(w.emitted("update:modelValue")).toBeUndefined();
    });

    it("discards a guard result after unmount and removes listeners", async () => {
      const d = deferred();
      const beforeClose = vi.fn(() => d.promise);
      const w = mountGuarded({ beforeClose });
      await button(w);
      w.unmount();
      d.resolve(true);
      await flushPromises();
      expect(w.emitted("update:modelValue")).toBeUndefined();
      escape();
      expect(beforeClose).toHaveBeenCalledTimes(1);
    });

    it("ignores Escape and backdrop clicks while closed", async () => {
      const beforeClose = vi.fn().mockResolvedValue(true);
      mountGuarded({ modelValue: false, beforeClose });
      escape();
      await flushPromises();
      expect(beforeClose).not.toHaveBeenCalled();
    });

    it("does not treat a click inside the form as a backdrop click", async () => {
      const beforeClose = vi.fn().mockResolvedValue(true);
      const w = mountGuarded({ beforeClose });
      await w.find(".tr-form-drawer__body").trigger("click");
      await flushPromises();
      expect(beforeClose).not.toHaveBeenCalled();
    });

    it("exposes requestClose with a programmatic reason", async () => {
      const beforeClose = vi.fn().mockResolvedValue(true);
      const w = mountGuarded({ beforeClose });
      await expect(w.vm.requestClose()).resolves.toBe(true);
      expect(beforeClose).toHaveBeenCalledWith("programmatic");
    });

    it("keeps submit gating independent of the close guard", async () => {
      const w = mountGuarded({ busy: true, beforeClose: () => false });
      await w.find(".tr-form-drawer__form").trigger("submit");
      expect(w.emitted("submit")).toBeUndefined();
    });
  });
});
