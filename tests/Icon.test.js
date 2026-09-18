import { describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";
import { mount } from "@vue/test-utils";

import Icon from "../src/components/Icon.vue";
import { iconRegistryKey } from "../src/icon-registry.js";

const FakeSvgComponent = {
  template: '<svg data-fake="component"></svg>',
};

const FakeBIcon = {
  name: "BIcon",
  props: { icon: { type: String, default: null } },
  template: '<span class="icon"><i class="mdi" :data-icon="icon"></i></span>',
};

function mountWithBuefy(component, options = {}) {
  return mount(component, {
    ...options,
    global: {
      ...options.global,
      components: { BIcon: FakeBIcon, ...options.global?.components },
    },
  });
}

describe("Icon", () => {
  it("resolves a name from the @iam3xtr/ui default registry with no provideIconRegistry call", () => {
    const wrapper = mount(Icon, { props: { name: "anthropic" } });
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.classes()).toContain("tr-icon");
  });

  it("renders a registered component entry from the consumer registry", () => {
    const wrapper = mount(Icon, {
      props: { name: "some-custom-name" },
      global: { provide: { [iconRegistryKey]: { "some-custom-name": FakeSvgComponent } } },
    });
    expect(wrapper.find("[data-fake=component]").exists()).toBe(true);
    expect(wrapper.classes()).toContain("tr-icon");
  });

  it("renders a registered raw-markup string entry via v-html", () => {
    const wrapper = mount(Icon, {
      props: { name: "some-markup-name" },
      global: { provide: { [iconRegistryKey]: { "some-markup-name": '<svg data-fake="markup"></svg>' } } },
    });
    expect(wrapper.find("[data-fake=markup]").exists()).toBe(true);
  });

  it("consumer registry overrides a @iam3xtr/ui default entry of the same name", () => {
    const wrapper = mount(Icon, {
      props: { name: "anthropic" },
      global: { provide: { [iconRegistryKey]: { anthropic: '<svg data-fake="override"></svg>' } } },
    });
    expect(wrapper.find("[data-fake=override]").exists()).toBe(true);
  });

  it("falls back to an aria-hidden placeholder when the name is not registered anywhere and Buefy is absent", () => {
    const wrapper = mount(Icon, {
      props: { name: "totally-unregistered-name", size: 32 },
      global: { provide: { [iconRegistryKey]: {} } },
    });
    const placeholder = wrapper.find(".tr-icon--placeholder");
    expect(placeholder.exists()).toBe(true);
    expect(placeholder.attributes("aria-hidden")).toBe("true");
    expect(placeholder.attributes("style")).toContain("32px");
  });

  it("works with no registry provided at all (no injection), falling back to the placeholder for an unresolved name", () => {
    const wrapper = mount(Icon, { props: { name: "totally-unregistered-name" } });
    expect(wrapper.find(".tr-icon--placeholder").exists()).toBe(true);
  });

  it("accepts the Buefy-compatible `icon` prop as an alias for `name`", () => {
    const wrapper = mount(Icon, { props: { icon: "anthropic" } });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("falls back to the globally registered BIcon (MDI) when no SVG entry matches", () => {
    const wrapper = mountWithBuefy(Icon, { props: { name: "account" } });
    expect(wrapper.findComponent(FakeBIcon).exists()).toBe(true);
    expect(wrapper.findComponent(FakeBIcon).props("icon")).toBe("account");
    expect(wrapper.classes()).toContain("tr-icon");
  });

  it("prefers an SVG match over the Buefy fallback even when BIcon is registered", () => {
    const wrapper = mountWithBuefy(Icon, { props: { name: "anthropic" } });
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.findComponent(FakeBIcon).exists()).toBe(false);
  });

  it("renders default slot content, taking precedence over name/icon", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(Icon, {
      props: { name: "anthropic" },
      slots: { default: () => h("i", { class: "mdi mdi-slot-content" }) },
    });
    expect(wrapper.find(".mdi-slot-content").exists()).toBe(true);
    expect(wrapper.find("svg").exists()).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("default slot"));
    warn.mockRestore();
  });

  it("ignores a whitespace-only default slot and falls through to name/icon resolution", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(Icon, {
      props: { name: "anthropic" },
      slots: { default: () => "   " },
    });
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns once when name and icon are both given with different values, and name wins", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mount(Icon, { props: { name: "anthropic", icon: "openai" } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"name"'));
    expect(wrapper.find("svg").exists()).toBe(true);
    warn.mockRestore();
  });

  it("does not warn when name and icon are given with the same value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(Icon, { props: { name: "anthropic", icon: "anthropic" } });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("forwards class/style/title/aria attrs to the raw-markup SVG branch (@iam3xtr/ui default)", () => {
    const wrapper = mount(Icon, {
      props: { name: "anthropic" },
      attrs: { class: "extra-class", title: "Anthropic", "aria-hidden": "true" },
    });
    expect(wrapper.classes()).toContain("extra-class");
    expect(wrapper.attributes("title")).toBe("Anthropic");
    expect(wrapper.attributes("aria-hidden")).toBe("true");
  });

  it("forwards class/style/title/aria attrs to a component-registry SVG branch", () => {
    const wrapper = mount(Icon, {
      props: { name: "some-custom-name" },
      attrs: { class: "extra-class", title: "Custom" },
      global: { provide: { [iconRegistryKey]: { "some-custom-name": FakeSvgComponent } } },
    });
    const svg = wrapper.find("svg");
    expect(svg.classes()).toContain("extra-class");
    expect(svg.attributes("title")).toBe("Custom");
  });

  it("forwards attrs to the Buefy fallback branch", () => {
    const wrapper = mountWithBuefy(Icon, {
      props: { name: "account" },
      attrs: { class: "extra-class", title: "Account" },
    });
    expect(wrapper.classes()).toContain("extra-class");
    expect(wrapper.attributes("title")).toBe("Account");
  });

  it("keeps app.use(Buefy)-free rendering unaffected: no global BIcon means no fallback, just the placeholder", () => {
    const wrapper = mount(Icon, { props: { name: "account" } });
    expect(wrapper.find(".tr-icon--placeholder").exists()).toBe(true);
  });

  it("works via direct import with no trVue plugin, no Buefy install and no static BIcon import", () => {
    const app = createApp({ template: "<div/>" });
    expect(app.component("BIcon")).toBeUndefined();
    const wrapper = mount(Icon, { props: { name: "anthropic" } });
    expect(wrapper.find("svg").exists()).toBe(true);
  });
});
