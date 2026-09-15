import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import Buefy from "buefy";

import PageHeader from "../src/components/navigation/PageHeader.vue";
import NavbarTabs from "../src/components/navigation/NavbarTabs.vue";
import TariffSummaryCard from "../src/components/navigation/TariffSummaryCard.vue";

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: { template: "<div/>" } },
      { path: "/plans", name: "plans", component: { template: "<div/>" } },
    ],
  });
}

describe("PageHeader", () => {
  it("treats neither title nor subtitle set as the loading signal", async () => {
    const router = makeRouter();
    const wrapper = mount(PageHeader, { global: { plugins: [router, Buefy] } });
    await router.isReady();
    expect(wrapper.find(".page-header__skeleton--title").exists()).toBe(true);
    expect(wrapper.find(".page-header__skeleton--subtitle").exists()).toBe(true);
  });

  it("a present title with no subtitle is a normal state, not a skeleton", async () => {
    const router = makeRouter();
    const wrapper = mount(PageHeader, { props: { title: "Agents" }, global: { plugins: [router, Buefy] } });
    await router.isReady();
    expect(wrapper.find(".page-header__title").text()).toBe("Agents");
    expect(wrapper.find(".page-header__skeleton--subtitle").exists()).toBe(false);
  });

  it("renders a back RouterLink only when back is passed, using the caller's own target", async () => {
    const router = makeRouter();
    const wrapper = mount(PageHeader, {
      props: { title: "Detail", back: { to: { name: "home" }, title: "Back" } },
      global: { plugins: [router, Buefy] },
    });
    await router.isReady();
    const back = wrapper.find(".page-header__back");
    expect(back.exists()).toBe(true);
    expect(back.attributes("title")).toBe("Back");
  });
});

describe("NavbarTabs", () => {
  it("renders one RouterLink per item and a default Russian aria-label", async () => {
    const router = makeRouter();
    const wrapper = mount(NavbarTabs, {
      props: { items: [{ label: "Overview", to: { name: "home" } }] },
      global: { plugins: [router] },
    });
    await router.isReady();
    expect(wrapper.attributes("aria-label")).toBe("Навигационные вкладки");
    expect(wrapper.findAll(".tr-navbar-tabs__link")).toHaveLength(1);
  });
});

describe("TariffSummaryCard", () => {
  const tariff = {
    displayName: "Pro",
    tagType: true,
    limits: [{ key: "seats", label: "Seats", progress: 40, caption: "4 / 10" }],
  };

  it("renders a plain div when no `to` is given — no hardcoded product route", () => {
    const wrapper = mount(TariffSummaryCard, { props: { tariff } });
    expect(wrapper.element.tagName).toBe("DIV");
  });

  it("renders as a RouterLink to the caller-supplied target when `to` is given", async () => {
    const router = makeRouter();
    const wrapper = mount(TariffSummaryCard, {
      props: { tariff, to: { name: "plans" } },
      global: { plugins: [router] },
    });
    await router.isReady();
    expect(wrapper.element.tagName).toBe("A");
    expect(wrapper.attributes("href")).toBe("/plans");
  });

  it("uses an overridable heading label", () => {
    const wrapper = mount(TariffSummaryCard, { props: { tariff, label: "Plan" } });
    expect(wrapper.text()).toContain("Plan");
    expect(wrapper.text()).toContain("Pro");
  });
});
