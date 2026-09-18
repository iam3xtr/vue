import { describe, expect, it, vi } from "vitest";
import { createApp } from "vue";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import Buefy from "buefy";

import { trVue, trVueComponents } from "../src/plugin.js";

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", name: "home", component: { template: "<div/>" } }],
  });
}

describe("trVue plugin", () => {
  it("registers every documented tr-* global name as a component", () => {
    const app = createApp({ template: "<div/>" });
    app.use(trVue);
    for (const name of Object.keys(trVueComponents)) {
      expect(app.component(name)).toBeTruthy();
    }
  });

  it("covers both core and navigation public components", () => {
    expect(Object.keys(trVueComponents)).toEqual(
      expect.arrayContaining([
        "tr-icon",
        "tr-loader",
        "tr-async-state",
        "tr-list-async-state",
        "tr-copy-pre",
        "tr-toolbar",
        "tr-toolbar-dropdown",
        "tr-toolbar-search",
        "tr-mobile-filters",
        "tr-navbar-menu",
        "tr-file-drop-target",
        "tr-form-drawer",
        "tr-page-header",
        "tr-navbar-tabs",
        "tr-tariff-summary-card",
      ]),
    );
  });

  it("a second install() call on the same app is a no-op and never warns", () => {
    // Exercises `trVue.install(app)` directly, twice — this is the guard
    // this plugin itself owns (no duplicate `app.component()` call, so no
    // "Component already registered" warning). Vue's own `app.use(plugin)`
    // additionally tracks plugin identity and warns "Plugin has already
    // been applied to target app" on a literal second `app.use(trVue)` —
    // that separate, Vue-level message fires before `install()` even runs
    // and is not this plugin's concern to suppress; what this plugin must
    // avoid is a second, real component (re-)registration.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = createApp({ template: "<div/>" });
    trVue.install(app);
    trVue.install(app);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("install() never calls app.use()/createRouter() itself and never registers Buefy", () => {
    const app = createApp({ template: "<div/>" });
    const useSpy = vi.spyOn(app, "use");
    app.use(trVue);
    // `useSpy` itself records this one call (app.use(trVue)); trVue's own
    // install() body must not trigger any further `app.use()` call.
    expect(useSpy).toHaveBeenCalledTimes(1);
    expect(app.component("b-icon")).toBeUndefined();
  });

  it("renders a registered core global component (tr-loader)", () => {
    const wrapper = mount(
      { template: '<tr-loader label="Loading" />' },
      { global: { plugins: [trVue] } },
    );
    expect(wrapper.find(".tr-loader").exists()).toBe(true);
  });

  it("renders a registered navigation global component (tr-navbar-tabs) once Router is installed", async () => {
    const router = makeRouter();
    const wrapper = mount(
      { template: '<tr-navbar-tabs :items="items" />' },
      {
        global: {
          plugins: [router, trVue],
        },
        data() {
          return { items: [{ label: "Overview", to: { name: "home" } }] };
        },
      },
    );
    await router.isReady();
    expect(wrapper.find(".tr-navbar-tabs__link").exists()).toBe(true);
  });

  it("renders a registered navigation global component needing Buefy (tr-page-header back link)", async () => {
    const router = makeRouter();
    const wrapper = mount(
      { template: '<tr-page-header title="Detail" :back="{ to: { name: \'home\' } }" />' },
      { global: { plugins: [router, Buefy, trVue] } },
    );
    await router.isReady();
    expect(wrapper.find(".page-header__back").exists()).toBe(true);
  });

  // Issue #8.2's acceptance text ("plugin `<icon>` выбирает ui/consumer SVG
  // прежде MDI"): the global `tr-icon`, resolved through the plugin like any
  // other consumer would use it, must still prefer an `@iam3xtr/ui` SVG
  // match over Buefy's MDI fallback even though both are available here.
  it("tr-icon prefers the @iam3xtr/ui SVG registry over the Buefy/MDI fallback", () => {
    const wrapper = mount(
      { template: '<tr-icon name="anthropic" />' },
      { global: { plugins: [Buefy, trVue] } },
    );
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.find(".mdi-anthropic").exists()).toBe(false);
  });
});
