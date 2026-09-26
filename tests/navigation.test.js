import { describe, expect, it, vi } from "vitest";
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

  const tabItems = [
    { label: "Home", to: { name: "home" } },
    { label: "Plans", to: { name: "plans" } },
    { label: "Usage", to: { name: "usage" } },
  ];

  function makeTabsRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: ["home", "plans", "usage"].map((name) => ({
        path: name === "home" ? "/" : `/${name}`,
        name,
        component: { template: "<div/>" },
      })),
    });
  }

  function rect(left, width) {
    return {
      left, right: left + width, width, top: 0, bottom: 48, height: 48, x: left, y: 0,
    };
  }

  /**
   * jsdom has no layout: fake a 100px viewport holding three 80px tabs laid
   * out from `viewportLeft - scrollLeft`, and a working `scrollBy`.
   */
  function fakeLayout(wrapper, { viewportWidth = 100, tabWidth = 80 } = {}) {
    const viewport = wrapper.find(".tr-navbar-tabs__viewport").element;
    let scrollLeft = 0;
    const links = () => wrapper.findAll(".tr-navbar-tabs__link").map((link) => link.element);
    const contentWidth = () => links().length * tabWidth;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, get: () => viewportWidth },
      scrollWidth: { configurable: true, get: () => Math.max(contentWidth(), viewportWidth) },
      scrollLeft: {
        configurable: true,
        get: () => scrollLeft,
        set: (value) => {
          scrollLeft = Math.min(Math.max(value, 0), Math.max(contentWidth() - viewportWidth, 0));
        },
      },
    });
    viewport.getBoundingClientRect = () => rect(0, viewportWidth);
    viewport.scrollBy = vi.fn(({ left }) => {
      viewport.scrollLeft = scrollLeft + left;
      viewport.dispatchEvent(new Event("scroll"));
    });
    links().forEach((link, index) => {
      link.getBoundingClientRect = () => rect(index * tabWidth - scrollLeft, tabWidth);
    });
    return viewport;
  }

  async function mountTabs(props = {}, layout = {}) {
    const router = makeTabsRouter();
    router.push("/");
    await router.isReady();
    const wrapper = mount(NavbarTabs, {
      props: { items: tabItems, ...props },
      global: { plugins: [router] },
      attachTo: document.body,
    });
    const viewport = fakeLayout(wrapper, layout);
    window.dispatchEvent(new Event("resize"));
    await wrapper.vm.$nextTick();
    return { wrapper, router, viewport };
  }

  it("renders no arrows while every tab fits", async () => {
    const { wrapper } = await mountTabs({}, { viewportWidth: 400 });
    expect(wrapper.find(".tr-navbar-tabs__arrow").exists()).toBe(false);
    expect(wrapper.classes()).not.toContain("is-overflowing");
    wrapper.unmount();
  });

  it("shows named arrows with disabled state only when tabs overflow", async () => {
    const { wrapper } = await mountTabs();
    expect(wrapper.classes()).toContain("is-overflowing");
    const prev = wrapper.find(".tr-navbar-tabs__arrow--prev");
    const next = wrapper.find(".tr-navbar-tabs__arrow--next");
    expect(prev.attributes("aria-label")).toBe("Предыдущие вкладки");
    expect(next.attributes("aria-label")).toBe("Следующие вкладки");
    expect(prev.attributes("type")).toBe("button");
    expect(prev.element.disabled).toBe(true);
    expect(next.element.disabled).toBe(false);
    wrapper.unmount();
  });

  it("scrolls to the next and previous hidden tab and updates disabled state", async () => {
    const { wrapper, viewport } = await mountTabs();
    const next = wrapper.find(".tr-navbar-tabs__arrow--next");
    const prev = wrapper.find(".tr-navbar-tabs__arrow--prev");

    await next.trigger("click");
    // Tab 2 (80–160) is the first one past the 100px edge: align its end.
    expect(viewport.scrollBy).toHaveBeenLastCalledWith({ left: 60 });
    await next.trigger("click");
    expect(viewport.scrollLeft).toBe(140);
    expect(next.element.disabled).toBe(true);
    expect(prev.element.disabled).toBe(false);

    await prev.trigger("click");
    // Tab 2 now starts at -60: align its start with the viewport.
    expect(viewport.scrollBy).toHaveBeenLastCalledWith({ left: -60 });
    wrapper.unmount();
  });

  it("moves focus to the opposite arrow when the focused arrow becomes disabled", async () => {
    const { wrapper } = await mountTabs();
    const next = wrapper.find(".tr-navbar-tabs__arrow--next");
    const prev = wrapper.find(".tr-navbar-tabs__arrow--prev");

    next.element.focus();
    await next.trigger("click");
    expect(document.activeElement).toBe(next.element);
    await next.trigger("click");
    await wrapper.vm.$nextTick();
    expect(next.element.disabled).toBe(true);
    expect(document.activeElement).toBe(prev.element);

    await prev.trigger("click");
    await prev.trigger("click");
    await wrapper.vm.$nextTick();
    expect(prev.element.disabled).toBe(true);
    expect(document.activeElement).toBe(next.element);
    wrapper.unmount();
  });

  it("keeps the active tab visible after a route change", async () => {
    const { wrapper, router, viewport } = await mountTabs();
    await router.push("/usage");
    await vi.waitFor(() => expect(viewport.scrollLeft).toBe(140));
    expect(wrapper.find('[aria-current="page"]').text()).toBe("Usage");
    wrapper.unmount();
  });

  it("accepts consumer-provided arrow names and keeps route links", async () => {
    const { wrapper } = await mountTabs({ prevLabel: "Previous tabs", nextLabel: "Next tabs", ariaLabel: "Sections" });
    expect(wrapper.attributes("aria-label")).toBe("Sections");
    expect(wrapper.find(".tr-navbar-tabs__arrow--prev").attributes("aria-label")).toBe("Previous tabs");
    expect(wrapper.find(".tr-navbar-tabs__arrow--next").attributes("aria-label")).toBe("Next tabs");
    expect(wrapper.findAll("a.tr-navbar-tabs__link").map((link) => link.attributes("href")))
      .toEqual(["/", "/plans", "/usage"]);
    wrapper.unmount();
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

  // Issue #11.1 ("Сделать tariff card доступной ссылкой на тарифы"): the
  // card must carry exactly one link semantic — no nested interactive
  // control (e.g. Buefy's `b-progress`) that would create a second target
  // or double-navigate on click/keyboard activation.
  it("has exactly one interactive/focusable element — the card's own RouterLink root", async () => {
    const router = makeRouter();
    const wrapper = mount(TariffSummaryCard, {
      props: { tariff, to: { name: "plans" } },
      global: { plugins: [router, Buefy] },
    });
    await router.isReady();

    const interactive = wrapper.findAll("a, button, input, [tabindex]");
    expect(interactive).toHaveLength(1);
    expect(interactive[0].element).toBe(wrapper.element);
  });
});
