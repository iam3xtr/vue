import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
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
});
