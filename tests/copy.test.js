import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import Buefy from "buefy";
import { h } from "vue";
import { Loader, AsyncState, ListAsyncState, CopyPre, FileDropTarget, FormDrawer,
  MobileFilters, Toolbar, ToolbarSearch, ToolbarDropdown, MessageComposer, ModelSelect, Icon } from "../src/index.js";
import { NavbarTabs, PageHeader, TariffSummaryCard } from "../src/navigation.js";
import { createMemoryHistory, createRouter } from "vue-router";

const wrappers = [];
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: { template: "<div />" } }] });
function render(component, props = {}, extra = {}) {
  const wrapper = mount(component, { props, global: { plugins: [Buefy, router] }, ...extra });
  wrappers.push(wrapper);
  return wrapper;
}
afterEach(() => { wrappers.splice(0).forEach((w) => w.unmount()); vi.restoreAllMocks(); });

describe("consumer copy contract", () => {
  it.each([
    [Loader, {}, "Loader: supply localized label"],
    [CopyPre, { text: "code" }, "CopyPre: supply localized buttonLabel"],
    [FileDropTarget, {}, "FileDropTarget: supply localized overlayLabel"],
    [FormDrawer, { modelValue: false }, "FormDrawer: supply localized closeAriaLabel"],
    [MobileFilters, {}, "MobileFilters: supply localized triggerAriaLabel"],
    [ToolbarSearch, { modelValue: "", placeholder: " " }, "ToolbarSearch: supply localized"],
    [ToolbarDropdown, { modelValue: "", options: [], allLabel: "" }, "ToolbarDropdown: supply localized"],
    [NavbarTabs, { items: [] }, "NavbarTabs: supply localized ariaLabel"],
    [PageHeader, { back: { to: "/" } }, "PageHeader: supply localized back.title"],
    [MessageComposer, {}, "MessageComposer: supply localized textareaAriaLabel"],
    [ModelSelect, {}, "ModelSelect: supply localized triggerAriaLabel"],
  ])("diagnoses missing or blank names without supplying package text (%#)", (component, props, message) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = render(component, props);
    expect(warn.mock.calls.flat().some((s) => String(s).startsWith(message))).toBe(true);
    expect(wrapper.text()).not.toMatch(/Загрузка|Закрыть|Копировать|Открыть фильтры/);
  });

  it("accepts ModelSelect's documented external native label path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(ModelSelect, { inputId: "consumer-model", searchAriaLabel: "Search" });
    expect(warn.mock.calls.flat().some((s) => String(s).startsWith("ModelSelect:"))).toBe(false);
  });

  it("forwards reactive consumer loading names through both async wrappers", async () => {
    const direct = render(AsyncState, { variant: "loading", message: "Loading" });
    const list = render(ListAsyncState, { loading: true, loadingLabel: "Loading" });
    for (const wrapper of [direct, list]) expect(wrapper.find(".tr-loader").attributes("aria-label")).toBe("Loading");
    await direct.setProps({ title: "Cargando" });
    await list.setProps({ loadingLabel: "Cargando" });
    for (const wrapper of [direct, list]) expect(wrapper.find(".tr-loader").attributes("aria-label")).toBe("Cargando");
  });

  it("forwards Toolbar mobile naming on locale changes without changing controlled search", async () => {
    const wrapper = render(Toolbar, { search: "draft", searchPlaceholder: "Search", filtersAriaLabel: "Open filters", filtersTitle: "Filters" }, { slots: { filters: () => h("button", "State") } });
    expect(wrapper.find(".tr-mobile-filters__trigger").attributes("aria-label")).toBe("Open filters");
    await wrapper.setProps({ searchPlaceholder: "Buscar", filtersAriaLabel: "Abrir filtros", filtersTitle: "Filtros" });
    expect(wrapper.find(".tr-mobile-filters__trigger").attributes("aria-label")).toBe("Abrir filtros");
    expect(wrapper.find("input").element.value).toBe("draft");
    expect(wrapper.emitted("update:search")).toBeUndefined();
  });

  it("omits optional plan heading and tooltip rather than supplying a language", () => {
    expect(render(TariffSummaryCard, { tariff: { displayName: "Pro", limits: [] } }).find(".tr-sidebar-tariff__label").text()).toBe("");
    expect(render(MobileFilters, { triggerAriaLabel: "Filters" }).find("button").attributes("title")).toBeUndefined();
  });

  it("hides decorative icons and preserves explicit names for meaningful icons", async () => {
    const icon = render(Icon, { name: "openai" });
    expect(icon.attributes("aria-hidden")).toBe("true");
    await icon.setProps({ role: "img", "aria-label": "Provider" });
    expect(icon.attributes("aria-label")).toBe("Provider");
    expect(icon.attributes("aria-hidden")).toBeUndefined();
    const mdi = render(Icon, { name: "cog", role: "img", "aria-label": "Settings" });
    expect(mdi.attributes("aria-label")).toBe("Settings");
    expect(mdi.attributes("aria-hidden")).not.toBe("true");
  });
});
