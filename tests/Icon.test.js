import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import Icon from "../src/components/Icon.vue";
import { iconRegistryKey } from "../src/icon-registry.js";

const FakeSvgComponent = {
  template: '<svg data-fake="component"></svg>',
};

describe("Icon", () => {
  it("renders a registered component entry", () => {
    const wrapper = mount(Icon, {
      props: { name: "anthropic" },
      global: { provide: { [iconRegistryKey]: { anthropic: FakeSvgComponent } } },
    });
    expect(wrapper.find("[data-fake=component]").exists()).toBe(true);
    expect(wrapper.classes()).toContain("tr-icon");
  });

  it("renders a registered raw-markup string entry via v-html", () => {
    const wrapper = mount(Icon, {
      props: { name: "brain" },
      global: { provide: { [iconRegistryKey]: { brain: '<svg data-fake="markup"></svg>' } } },
    });
    expect(wrapper.find("[data-fake=markup]").exists()).toBe(true);
  });

  it("falls back to an aria-hidden placeholder when the name is not registered", () => {
    const wrapper = mount(Icon, {
      props: { name: "missing", size: 32 },
      global: { provide: { [iconRegistryKey]: {} } },
    });
    const placeholder = wrapper.find(".tr-icon--placeholder");
    expect(placeholder.exists()).toBe(true);
    expect(placeholder.attributes("aria-hidden")).toBe("true");
    expect(placeholder.attributes("style")).toContain("32px");
  });

  it("works with no registry provided at all (no injection)", () => {
    const wrapper = mount(Icon, { props: { name: "anthropic" } });
    expect(wrapper.find(".tr-icon--placeholder").exists()).toBe(true);
  });
});
