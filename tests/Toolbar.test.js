import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import Buefy from "buefy";

import Toolbar from "../src/components/Toolbar.vue";
import ToolbarDropdown from "../src/components/ToolbarDropdown.vue";
import ToolbarSearch from "../src/components/ToolbarSearch.vue";
import MobileFilters from "../src/components/MobileFilters.vue";

const global_ = { plugins: [Buefy] };

describe("Toolbar", () => {
  it("hides the search field when the search prop is not passed", () => {
    const wrapper = mount(Toolbar, { global: global_ });
    expect(wrapper.findComponent(ToolbarSearch).exists()).toBe(false);
  });

  it("shows the search field once search is a string (including empty)", () => {
    const wrapper = mount(Toolbar, { props: { search: "" }, global: global_ });
    expect(wrapper.findComponent(ToolbarSearch).exists()).toBe(true);
  });

  it("v-model:search round-trips through update:search", async () => {
    const wrapper = mount(Toolbar, {
      props: { search: "abc", "onUpdate:search": (v) => wrapper.setProps({ search: v }) },
      global: global_,
    });
    await wrapper.findComponent(ToolbarSearch).vm.$emit("update:modelValue", "xyz");
    expect(wrapper.props("search")).toBe("xyz");
  });

  it("re-emits the shortcut event from the nested ToolbarSearch", async () => {
    const wrapper = mount(Toolbar, { props: { search: "" }, global: global_ });
    await wrapper.findComponent(ToolbarSearch).vm.$emit("shortcut");
    expect(wrapper.emitted("shortcut")).toHaveLength(1);
  });

  it("renders the filters slot both inline and inside MobileFilters", () => {
    const wrapper = mount(Toolbar, {
      slots: { filters: '<span class="my-filter">F</span>' },
      global: global_,
    });
    expect(wrapper.findAll(".my-filter")).toHaveLength(2);
    expect(wrapper.findComponent(MobileFilters).exists()).toBe(true);
  });

  it("falls back to the default slot when no actions slot is given", () => {
    const wrapper = mount(Toolbar, {
      slots: { default: '<button class="act">Go</button>' },
      global: global_,
    });
    expect(wrapper.find(".act").exists()).toBe(true);
  });
});

describe("ToolbarDropdown", () => {
  it("normalizes plain-string options and shows the selected label", async () => {
    const wrapper = mount(ToolbarDropdown, {
      props: { options: ["a", "b"], allLabel: "All", modelValue: "a" },
      global: global_,
    });
    expect(wrapper.text()).toContain("a");
  });

  it("shows allLabel when nothing is selected", () => {
    const wrapper = mount(ToolbarDropdown, {
      props: { options: [{ value: "a", label: "A" }], allLabel: "All", modelValue: "" },
      global: global_,
    });
    expect(wrapper.find(".tr-toolbar-dropdown__label").text()).toBe("All");
  });
});

describe("MobileFilters", () => {
  it("exposes overridable, non-empty default trigger labels", () => {
    const wrapper = mount(MobileFilters, { global: global_ });
    const trigger = wrapper.find(".tr-mobile-filters__trigger");
    expect(trigger.attributes("aria-label")).toBe("Открыть фильтры");
    expect(trigger.attributes("title")).toBe("Фильтры");
  });

  it("accepts custom labels", () => {
    const wrapper = mount(MobileFilters, {
      props: { triggerAriaLabel: "Open filters", triggerTitle: "Filters" },
      global: global_,
    });
    const trigger = wrapper.find(".tr-mobile-filters__trigger");
    expect(trigger.attributes("aria-label")).toBe("Open filters");
  });
});

describe("ToolbarSearch", () => {
  it("registers and cleans up the global keydown listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const wrapper = mount(ToolbarSearch, {
      props: { placeholder: "Search", modelValue: "" },
      global: global_,
    });
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    const handler = addSpy.mock.calls.find(([type]) => type === "keydown")[1];
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", handler);
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("emits shortcut on Ctrl+K and focuses the field", async () => {
    const wrapper = mount(ToolbarSearch, {
      props: { placeholder: "Search", modelValue: "" },
      attachTo: document.body,
      global: global_,
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("shortcut")).toHaveLength(1);
    wrapper.unmount();
  });
});
