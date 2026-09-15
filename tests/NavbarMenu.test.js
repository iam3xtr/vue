import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import NavbarMenu from "../src/components/NavbarMenu.vue";
import { navbarMenuKey } from "../src/composables/navbarMenu.js";

describe("NavbarMenu", () => {
  it("renders nothing when no target is provided (e.g. an SSR render with no shell)", () => {
    const wrapper = mount(NavbarMenu, { slots: { default: "<span>menu</span>" } });
    expect(wrapper.html()).toBe("<!--v-if-->");
  });

  it("teleports its default slot into the injected target", () => {
    const target = document.createElement("div");
    target.id = "navbar-target";
    document.body.appendChild(target);

    mount(NavbarMenu, {
      slots: { default: '<a class="tab">Tab</a>' },
      global: { provide: { [navbarMenuKey]: target } },
      attachTo: document.body,
    });

    expect(target.querySelector(".tab")).not.toBeNull();
    target.remove();
  });
});
