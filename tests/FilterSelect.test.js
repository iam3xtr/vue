import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import Buefy from "buefy";
import FilterSelect from "../src/components/FilterSelect.vue";

const copy = { ariaLabel: "Provider", placeholder: "All providers", resetLabel: "Reset", selectedCountLabel: "{count} selected", emptyLabel: "No options", loadingLabel: "Loading" };
const options = [{ value: "a", label: "Alpha" }, { value: "off", label: "Off", disabled: true }, { value: "b", label: "Beta" }];
const mounted = [];
const hosts = [];
function render(props = {}, extra = {}) {
  const wrapper = mount(FilterSelect, { props: { ...copy, options, ...props }, attachTo: document.body, global: { plugins: [Buefy] }, ...extra });
  mounted.push(wrapper); return wrapper;
}
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick(); await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
const trigger = (wrapper) => wrapper.find(".tr-filter-select__trigger");
const items = (wrapper) => wrapper.findAll('[role="option"]');
async function open(wrapper, key = "ArrowDown") {
  await trigger(wrapper).trigger("keydown", { key }); await settle();
}
afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()); hosts.splice(0).forEach((h) => h.remove()); vi.restoreAllMocks(); });

describe("FilterSelect controlled selection", () => {
  it("opens/focuses without selecting and exposes a named single listbox", async () => {
    const wrapper = render(); await open(wrapper);
    expect(trigger(wrapper).attributes("aria-expanded")).toBe("true");
    expect(wrapper.find('[role="listbox"]').attributes("aria-label")).toBe("Provider");
    expect(wrapper.find('[role="listbox"]').attributes("aria-multiselectable")).toBeUndefined();
    expect(document.activeElement).toBe(items(wrapper)[0].element);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });
  it("commits a string without coercion, closes and returns focus", async () => {
    const wrapper = render({ options: [{ value: "0001", label: "Leading zero" }] });
    await open(wrapper); await items(wrapper)[0].trigger("click"); await settle();
    expect(wrapper.emitted("update:modelValue")).toEqual([["0001"]]);
    expect(trigger(wrapper).attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger(wrapper).element);
    // Still controlled: no local replacement until consumer updates props.
    expect(wrapper.find(".tr-filter-select__value").text()).toBe("All providers");
    await wrapper.setProps({ modelValue: "0001" });
    expect(wrapper.find(".tr-filter-select__value").text()).toBe("Leading zero");
  });
  it("preserves historical IDs through catalog replacement without events", async () => {
    const wrapper = render({ modelValue: "missing" });
    expect(wrapper.find(".tr-filter-select__value").text()).toBe("missing");
    await wrapper.setProps({ options: [{ value: "missing", label: "Restored" }] });
    expect(wrapper.find(".tr-filter-select__value").text()).toBe("Restored");
    await wrapper.setProps({ options: [] });
    expect(wrapper.find(".tr-filter-select__value").text()).toBe("missing");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });
  it("deduplicates options and arrays, preserves model order/unknown IDs, never mutates inputs", async () => {
    const model = Object.freeze(["missing", "a", "a"]);
    const catalog = Object.freeze([...options.map((o) => Object.freeze(o)), { value: "a", label: "Duplicate" }, { value: 1, label: "Invalid" }]);
    const wrapper = render({ multiple: true, modelValue: model, options: catalog });
    await open(wrapper);
    expect(items(wrapper)).toHaveLength(3);
    expect(wrapper.find('[role="listbox"]').attributes("aria-multiselectable")).toBe("true");
    expect(wrapper.find('[role="status"]').text()).toBe("2 selected");
    await items(wrapper)[2].trigger("click");
    const emitted = wrapper.emitted("update:modelValue")[0][0];
    expect(emitted).toEqual(["missing", "a", "b"]);
    expect(emitted).not.toBe(model);
    expect(model).toEqual(["missing", "a", "a"]);
    await wrapper.setProps({ modelValue: emitted });
    await items(wrapper)[0].trigger("click");
    expect(wrapper.emitted("update:modelValue")[1][0]).toEqual(["missing", "b"]);
    expect(trigger(wrapper).attributes("aria-expanded")).toBe("true");
  });
  it.each([[false, "a", null], [true, ["unknown"], []]])("resets the controlled empty representation (multi=%s)", async (multiple, modelValue, empty) => {
    const wrapper = render({ multiple, modelValue }); await open(wrapper);
    await wrapper.find(".tr-filter-select__reset").trigger("click"); await settle();
    expect(wrapper.emitted("update:modelValue")).toEqual([[empty]]);
    expect(document.activeElement).toBe(trigger(wrapper).element);
  });
  it("does not emit a redundant reset or commit disabled options", async () => {
    const wrapper = render(); await open(wrapper);
    expect(wrapper.find(".tr-filter-select__reset").attributes("disabled")).toBeDefined();
    await items(wrapper)[1].trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });
  it.each(["disabled", "loading"])("blocks opening and commits while %s", async (key) => {
    const wrapper = render({ [key]: true, modelValue: "a" });
    await open(wrapper);
    expect(trigger(wrapper).attributes("disabled")).toBeDefined();
    expect(trigger(wrapper).attributes("aria-expanded")).toBe("false");
    await items(wrapper)[2].trigger("click");
    await wrapper.find(".tr-filter-select__reset").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });
  it("closing on loading/external disabled does not change selection", async () => {
    const wrapper = render({ modelValue: "a" }); await open(wrapper);
    await wrapper.setProps({ loading: true }); await settle();
    expect(trigger(wrapper).attributes("aria-expanded")).toBe("false");
    expect(wrapper.find('[role="status"]').text()).toBe("Loading");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });
});

describe("FilterSelect keyboard/copy/overlay", () => {
  it("arrows/Home/End skip disabled options and Enter explicitly commits, not focus", async () => {
    const wrapper = render(); await open(wrapper);
    await items(wrapper)[0].trigger("keydown", { key: "ArrowDown" }); await nextTick();
    expect(document.activeElement).toBe(items(wrapper)[2].element);
    await items(wrapper)[2].trigger("keydown", { key: "Home" }); await nextTick();
    expect(document.activeElement).toBe(items(wrapper)[0].element);
    await items(wrapper)[0].trigger("keydown", { key: "End" }); await nextTick();
    expect(document.activeElement).toBe(items(wrapper)[2].element);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    await items(wrapper)[2].trigger("keydown", { key: "Enter" }); await settle();
    expect(wrapper.emitted("update:modelValue")).toEqual([["b"]]);
  });
  it("Space toggles multi and Escape returns focus without leaking keyup to a host", async () => {
    const wrapper = render({ multiple: true }); await open(wrapper, "ArrowUp");
    expect(document.activeElement).toBe(items(wrapper)[2].element);
    await items(wrapper)[2].trigger("keydown", { key: " " });
    expect(wrapper.emitted("update:modelValue")).toEqual([[["b"]]]);
    const host = vi.fn(); document.addEventListener("keyup", host);
    try {
      await items(wrapper)[2].trigger("keydown", { key: "Escape" }); await settle();
      await trigger(wrapper).trigger("keyup", { key: "Escape" });
      expect(document.activeElement).toBe(trigger(wrapper).element);
      expect(host).not.toHaveBeenCalled();
      expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
    } finally { document.removeEventListener("keyup", host); }
  });
  it("does not swallow a later trigger Escape keyup after the consumed press was released elsewhere", async () => {
    const wrapper = render(); await open(wrapper);
    const host = vi.fn(); document.addEventListener("keyup", host);
    try {
      await items(wrapper)[0].trigger("keydown", { key: "Escape" }); await settle();
      document.body.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
      host.mockClear();
      await trigger(wrapper).trigger("keydown", { key: "Escape" });
      await trigger(wrapper).trigger("keyup", { key: "Escape" });
      expect(host).toHaveBeenCalledTimes(1);
    } finally { document.removeEventListener("keyup", host); }
  });
  it("reacts to consumer locale props and diagnoses missing copy without defaults", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = render({ multiple: true, modelValue: ["a"], selectedCountLabel: undefined });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("selectedCountLabel"));
    await wrapper.setProps({ selectedCountLabel: "{count} elegidos", ariaLabel: "Proveedor", resetLabel: "Restablecer" });
    expect(wrapper.find('[role="status"]').text()).toBe("1 elegidos");
    expect(trigger(wrapper).attributes("aria-label")).toBe("Proveedor");
    expect(wrapper.find(".tr-filter-select__reset").text()).toBe("Restablecer");
  });
  it("uses unique IDs and forwards classes for toolbar hosts", () => {
    const host = mount({ render: () => h("div", [h(FilterSelect, { ...copy, options, class: "consumer-filter" }), h(FilterSelect, { ...copy, options })]) }, { global: { plugins: [Buefy] } });
    mounted.push(host);
    const [first, second] = host.findAllComponents(FilterSelect);
    expect(first.find(".tr-filter-select").classes()).toContain("consumer-filter");
    expect(trigger(first).attributes("aria-controls")).not.toBe(trigger(second).attributes("aria-controls"));
  });
  it("cleans menu bounds/markers after close and unmount", async () => {
    const wrapper = render(); await open(wrapper); await settle();
    const menu = wrapper.find(".dropdown-menu").element;
    expect(menu.classList.contains("tr-dropdown-overlay")).toBe(true);
    expect(menu.style.maxHeight).not.toBe("");
    await items(wrapper)[0].trigger("keydown", { key: "Escape" }); await settle();
    expect(menu.classList.contains("tr-dropdown-overlay")).toBe(false);
    expect(menu.style.maxHeight).toBe("");
    expect(menu.style.position).toBe("");
    await open(wrapper); wrapper.unmount(); mounted.splice(mounted.indexOf(wrapper), 1);
    await settle();
    expect(menu.classList.contains("tr-dropdown-overlay")).toBe(false);
  });
});

const search = { searchable: true, searchLabel: "Search providers", noResultsLabel: "No matches" };
const custom = { allowCustom: true, customLabel: "Use {value}", customInvalidLabel: "Invalid value", customDuplicateLabel: "Already selected" };
const field = (wrapper) => wrapper.find(".tr-filter-select__search");
async function type(wrapper, value) { await field(wrapper).setValue(value); await nextTick(); }

describe("FilterSelect search and historical values", () => {
  it("matches label or value locally, keeps selection, and resets the query on close", async () => {
    const wrapper = render({ ...search, modelValue: "a" }); await open(wrapper);
    expect(document.activeElement).toBe(field(wrapper).element);
    await type(wrapper, " BET ");
    expect(items(wrapper).map((i) => i.text())).toEqual(["Beta"]);
    await type(wrapper, "off");
    expect(items(wrapper)).toHaveLength(1);
    await type(wrapper, "zzz");
    expect(items(wrapper)).toHaveLength(0);
    expect(wrapper.find(".tr-filter-select__state").text()).toBe("No matches");
    await type(wrapper, "");
    expect(items(wrapper)).toHaveLength(3);
    await field(wrapper).trigger("keydown", { key: "Escape" }); await settle();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    await open(wrapper);
    expect(field(wrapper).element.value).toBe("");
  });
  it("Enter and ArrowDown in the field never select; Enter does not submit a form", async () => {
    const submit = vi.fn();
    const host = mount({ render: () => h("form", { onSubmit: (e) => { e.preventDefault(); submit(); } }, [h(FilterSelect, { ...copy, ...search, options })]) },
      { attachTo: document.body, global: { plugins: [Buefy] } });
    mounted.push(host);
    const wrapper = host.findComponent(FilterSelect); await open(wrapper);
    await type(wrapper, "alp");
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    field(wrapper).element.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    await field(wrapper).trigger("keydown", { key: "ArrowDown" }); await nextTick();
    expect(document.activeElement).toBe(items(wrapper)[0].element);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(submit).not.toHaveBeenCalled();
    await items(wrapper)[0].trigger("keydown", { key: "ArrowUp" }); await nextTick();
    expect(document.activeElement).toBe(field(wrapper).element);
  });
  it("works in multi mode and shows historical IDs that can be removed and reintroduced", async () => {
    const wrapper = render({ ...search, multiple: true, modelValue: ["gone", "a"] }); await open(wrapper);
    expect(items(wrapper).map((i) => i.text())).toEqual(["gone✓", "Alpha✓", "Off", "Beta"]);
    await items(wrapper)[0].trigger("click");
    expect(wrapper.emitted("update:modelValue")[0][0]).toEqual(["a"]);
    await wrapper.setProps({ options: [...options, { value: "gone", label: "Gone back" }] });
    expect(items(wrapper).map((i) => i.text())).toContain("Gone back✓");
    expect(items(wrapper).filter((i) => i.classes("is-historical"))).toHaveLength(0);
    await type(wrapper, "gone");
    expect(items(wrapper)).toHaveLength(1);
  });
  it("search-off does not list historical entries or render a field", async () => {
    const wrapper = render({ multiple: true, modelValue: ["gone"] }); await open(wrapper);
    expect(field(wrapper).exists()).toBe(false);
    expect(items(wrapper)).toHaveLength(3);
  });
  it("commits custom values only explicitly, normalized, validated and deduplicated", async () => {
    const wrapper = render({ ...search, ...custom, multiple: true, modelValue: ["a"],
      validateCustom: (v) => /^[a-z-]+$/.test(v) }); await open(wrapper);
    await type(wrapper, "  new-model ");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.find(".tr-filter-select__custom").text()).toBe("Use new-model");
    await field(wrapper).trigger("keydown", { key: "Enter" }); await settle();
    expect(wrapper.emitted("update:modelValue")).toEqual([[["a", "new-model"]]]);
    expect(field(wrapper).element.value).toBe("");
    expect(trigger(wrapper).attributes("aria-expanded")).toBe("true");
    await wrapper.setProps({ modelValue: ["a", "new-model"] });
    await type(wrapper, "new-model");
    await wrapper.find(".tr-filter-select__custom").trigger("click");
    expect(wrapper.find('[role="alert"]').text()).toBe("Already selected");
    await type(wrapper, "BAD 1");
    await wrapper.find(".tr-filter-select__custom").trigger("click");
    expect(wrapper.find('[role="alert"]').text()).toBe("Invalid value");
    await type(wrapper, "b");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    await wrapper.find(".tr-filter-select__custom").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toHaveLength(2);
    expect(wrapper.emitted("update:modelValue")[1][0]).toEqual(["a", "new-model", "b"]);
  });
  it("single custom closes with focus return and keeps the value after reset", async () => {
    const wrapper = render({ ...custom, modelValue: null }); await open(wrapper);
    expect(wrapper.find(".tr-filter-select__custom").exists()).toBe(false);
    const wrapperS = render({ ...search, ...custom }); await open(wrapperS);
    await type(wrapperS, "legacy");
    await wrapperS.find(".tr-filter-select__custom").trigger("click"); await settle();
    expect(wrapperS.emitted("update:modelValue")).toEqual([["legacy"]]);
    expect(trigger(wrapperS).attributes("aria-expanded")).toBe("false");
    await wrapperS.setProps({ modelValue: "legacy" });
    await open(wrapperS);
    expect(items(wrapperS)[0].classes()).toContain("is-historical");
    await wrapperS.find(".tr-filter-select__reset").trigger("click"); await settle();
    expect(wrapperS.emitted("update:modelValue")[1]).toEqual([null]);
  });
  it("selects an existing catalog option instead of creating a duplicate; ignores IME composition", async () => {
    const wrapper = render({ ...search, ...custom, multiple: true }); await open(wrapper);
    await type(wrapper, "b");
    await field(wrapper).trigger("keydown", { key: "Enter", isComposing: true });
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    await field(wrapper).trigger("keydown", { key: "Enter" }); await settle();
    expect(wrapper.emitted("update:modelValue")).toEqual([[["b"]]]);
    await type(wrapper, "x");
    await field(wrapper).trigger("keydown", { key: "Escape", isComposing: true });
    expect(trigger(wrapper).attributes("aria-expanded")).toBe("true");
  });
  it("warns about missing search and custom copy", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render({ searchable: true, allowCustom: true });
    for (const name of ["searchLabel", "noResultsLabel", "customLabel", "customInvalidLabel", "customDuplicateLabel"]) {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(name));
    }
  });
});
