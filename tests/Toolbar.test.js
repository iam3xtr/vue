import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import Buefy from "buefy";
import { nextTick } from "vue";

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
      attachTo: document.body,
      global: global_,
    });
    try {
      // No ancestor clips overflow here, so MobileFilters keeps its panel
      // inline: both semantically identical filter trees live under the
      // wrapper.
      expect(wrapper.findAll(".my-filter")).toHaveLength(2);
      expect(document.body.querySelectorAll(".my-filter")).toHaveLength(2);
      expect(wrapper.findComponent(MobileFilters).exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
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

describe.each([
  ["ToolbarDropdown", ToolbarDropdown, { options: ["a"], allLabel: "All", modelValue: "" }],
  ["MobileFilters", MobileFilters, {}],
])("%s placement", (_name, Component, props) => {
  const mountIn = async (hostHtml) => {
    const host = document.createElement("div");
    host.innerHTML = hostHtml;
    document.body.appendChild(host);
    const target = host.querySelector(".mount");
    const wrapper = mount(Component, { props, attachTo: target, global: global_ });
    await nextTick();
    await nextTick();
    const menus = [...document.body.querySelectorAll(".dropdown-menu")];
    const menu = menus.find((el) => !el.closest(".dropdown-content")) ?? null;
    return {
      wrapper,
      menu,
      cleanup: () => {
        wrapper.unmount();
        host.remove();
      },
    };
  };

  it("keeps the menu inline when nothing clips it", async () => {
    const { menu, cleanup } = await mountIn('<div><div class="mount"></div></div>');
    try {
      expect(menu.closest(".mount")).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it("moves the menu to a body portal inside a clipping container", async () => {
    const { menu, cleanup } = await mountIn(
      '<div style="overflow: hidden"><div class="mount"></div></div>',
    );
    try {
      expect(menu.closest(".mount")).toBeNull();
      expect(menu.closest(".dropdown").parentElement.parentElement).toBe(document.body);
    } finally {
      cleanup();
    }
  });

  it("stays inline inside a modal even when clipped", async () => {
    const { menu, cleanup } = await mountIn(
      '<div class="modal"><div style="overflow: auto"><div class="mount"></div></div></div>',
    );
    try {
      expect(menu.closest(".mount")).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it.each([
    [
      "modal card body",
      '<div class="modal"><div class="modal-card"><section class="modal-card-body" style="overflow: auto"><div class="mount"></div></section></div></div>',
    ],
    [
      "form drawer body",
      '<div class="sidebar-content" style="overflow-y: auto"><div class="tr-form-drawer__body" style="overflow-y: auto"><div class="mount"></div></div></div>',
    ],
  ])("pins the open menu in place inside a clipping %s", async (_host, hostHtml) => {
    const { wrapper, menu, cleanup } = await mountIn(hostHtml);
    const settle = async () => {
      await nextTick();
      await nextTick();
      await new Promise((r) => setTimeout(r, 0));
      await nextTick();
      await nextTick();
    };
    try {
      await wrapper.find(".dropdown-trigger").trigger("click");
      await settle();
      expect(menu.closest(".mount")).not.toBeNull();
      expect(menu.style.getPropertyValue("position")).toBe("fixed");
      expect(menu.style.getPropertyValue("top")).toMatch(/px$/);
      await wrapper.find(".dropdown-trigger").trigger("click");
      await settle();
      expect(menu.style.getPropertyValue("position")).toBe("");
      expect(menu.style.getPropertyValue("top")).toBe("");
    } finally {
      cleanup();
    }
  });

  it("removes the Buefy body portal on unmount", async () => {
    const { cleanup } = await mountIn(
      '<div style="overflow: hidden"><div class="mount"></div></div>',
    );
    cleanup();
    expect(document.body.querySelector(".dropdown-menu")).toBeNull();
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
