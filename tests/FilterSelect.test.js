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
