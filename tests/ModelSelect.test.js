// Tests for the public `ModelSelect` contract.
//
// Focused on the package-level contract: closed-trigger display, the
// three `mode` shapes (`"model"`, `"byok"`, `"both"`), the four
// `v-model` links (`modelId`, `byokModelId`, `providerModelId`,
// `useOwnApiKey`), `update:query` emission, the open/close/focus
// lifecycle, the selected marker, loading/empty/error states, free-form
// validation and exclusivity, the consumer-owned `byok-key` slot, and
// the no-store / no-router / no-secret boundary spelled out in `.todo`
// and `.plan`. Overlay geometry (portal placement, flip) is covered by
// the existing `useDropdownOverlay` and `Toolbar`/`MobileFilters` tests;
// here only the scroll/resize survival after a re-render is pinned.
//
// Test inputs use the public `v-model` surface (`wrapper.setProps` /
// `wrapper.vm.<ref> = ...`) rather than private helpers; the package
// pins exclusivity and validation through that surface so the
// observable behaviour is what consumers actually rely on.
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import Buefy from "buefy";
import { h, nextTick } from "vue";

import ModelSelect from "../src/components/ModelSelect.vue";

const models = [
    { id: "gpt", name: "GPT", provider: { icon: "openai" } },
    { id: "claude", name: "Claude", provider: { icon: "anthropic" } },
    { id: "mistral", name: "Mistral", provider: { icon: "mistral" } },
];

const global_ = { plugins: [Buefy] };

function mountModel(props, opts = {}) {
    return mount(ModelSelect, {
        props,
        attachTo: opts.attach ?? document.body,
        global: { ...global_, ...(opts.global ?? {}) },
        slots: opts.slots,
    });
}

// Buefy opens the dropdown from a `setTimeout` inside its toggle; close
// is synchronous. Settle timers and the component's own ticks.
async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function triggerButton(wrapper) {
    return wrapper.find("button.tr-model-select__trigger");
}

function triggerValue(wrapper) {
    return wrapper.find(".tr-model-select__trigger-value").text();
}

function isOpen(wrapper) {
    return wrapper.classes().includes("tr-model-select--open");
}

async function openWithArrowDown(wrapper) {
    await triggerButton(wrapper).trigger("keydown", { key: "ArrowDown" });
    await settle();
}

function selectOption(wrapper, option) {
    wrapper.findComponent({ name: "BAutocomplete" }).vm.$emit("select", option);
}

function optionState(wrapper) {
    return wrapper.findAll(".tr-model-select__option").map((option) => ({
        name: option.find(".tr-model-select__option-name").text(),
        selected: option.classes().includes("tr-model-select__option--selected"),
        current: option.attributes("aria-current") ?? null,
        marker: option.find(".tr-model-select__option-marker").exists(),
    }));
}

describe("ModelSelect — mode=model (catalog)", () => {
    it("anchors the menu at the trigger's left edge in every mode", () => {
        for (const mode of ["model", "byok", "both"]) {
            const wrapper = mountModel({ mode, models });
            expect(wrapper.classes()).toContain("is-bottom-right");
            wrapper.unmount();
        }
    });

    it("displays the canonical name of v-model:modelId on the closed trigger", () => {
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt", "claude"],
            modelId: "claude",
        });
        expect(triggerValue(wrapper)).toBe("Claude");
    });

    it("does not fall back to a recommended entry when no modelId is provided", () => {
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt", "claude"],
            modelId: null,
        });
        expect(triggerValue(wrapper)).toBe("");
        expect(wrapper.emitted("update:modelId")).toBeUndefined();
    });

    it("falls back to triggerPlaceholder when no modelId is selected", () => {
        const wrapper = mountModel({
            models,
            recommendedModels: [],
            modelId: null,
            triggerPlaceholder: "Выберите модель",
        });
        expect(triggerValue(wrapper)).toBe("Выберите модель");
    });

    it("emits update:modelId on selection and round-trips through a parent v-model:model-id", async () => {
        const wrapper = mountModel({ models, recommendedModels: ["gpt"], modelId: null });
        selectOption(wrapper, models[1]);
        await nextTick();
        expect(wrapper.emitted("update:modelId")).toEqual([["claude"]]);
        expect(wrapper.emitted("update:modelValue")).toBeUndefined();
        expect(wrapper.emitted("update:byokModelId")).toBeUndefined();
        expect(wrapper.emitted("update:providerModelId")).toBeUndefined();

        // A real consumer binding: the compiled form of the kebab-case
        // `v-model:model-id` on a parent must receive the selected id and
        // feed it back to the trigger.
        const Host = {
            data: () => ({ selected: "gpt" }),
            render() {
                return h(ModelSelect, {
                    models,
                    "model-id": this.selected,
                    "onUpdate:model-id": (value) => (this.selected = value),
                });
            },
        };
        const host = mount(Host, { attachTo: document.body, global: global_ });
        expect(triggerValue(host)).toBe("GPT");
        host.findComponent({ name: "BAutocomplete" }).vm.$emit("select", models[1]);
        await nextTick();
        expect(host.vm.selected).toBe("claude");
        expect(triggerValue(host)).toBe("Claude");
        host.unmount();
        wrapper.unmount();
    });

    it("emits update:query with the raw typed value, never the selected model name", async () => {
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt"],
            searchResults: [models[1]],
            modelId: "gpt",
        });
        await openWithArrowDown(wrapper);
        await wrapper.findComponent({ name: "BAutocomplete" }).find("input").setValue(" cl");
        await settle();
        expect(wrapper.emitted("update:query")).toEqual([[" cl"]]);
        wrapper.unmount();
    });

    it("uses consumer-supplied recommendations while the query is empty", async () => {
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt", "claude"],
            searchResults: models,
            modelId: null,
        });
        await nextTick();
        expect(wrapper.vm.visibleOptions).toEqual([
            expect.objectContaining({ id: "gpt" }),
            expect.objectContaining({ id: "claude" }),
        ]);
    });

    it("renders provider icons without relying on global component registration", async () => {
        const wrapper = mountModel({ models, recommendedModels: ["gpt"], modelId: "gpt" });
        await openWithArrowDown(wrapper);
        expect(wrapper.find(".tr-model-select__option .tr-icon").exists()).toBe(true);
        wrapper.unmount();
    });

    it("uses consumer-supplied searchResults when the query is non-empty", async () => {
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt"],
            searchResults: [models[2]],
            modelId: null,
        });
        wrapper.vm.searchQuery = "mis";
        await nextTick();
        expect(wrapper.vm.visibleOptions).toEqual([expect.objectContaining({ id: "mistral" })]);
    });

    it("never filters its own catalog — empty searchResults with a query yields an empty list", async () => {
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt", "claude", "mistral"],
            searchResults: [],
            modelId: null,
        });
        wrapper.vm.searchQuery = "gpt";
        await nextTick();
        expect(wrapper.vm.visibleOptions).toEqual([]);
    });

    it("rejects an unsupported mode through the prop validator", () => {
        const validator = ModelSelect.props.mode.validator;
        expect(["model", "byok", "both"].map(validator)).toEqual([true, true, true]);
        expect(validator("catalog")).toBe(false);

        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            // Vue 3 prop validators warn and let the mount proceed: an
            // unknown mode is unsupported, not a crash for the consumer.
            const wrapper = mount(ModelSelect, {
                props: { models, mode: "catalog", modelId: null },
                global: global_,
            });
            expect(warn.mock.calls.some(([message]) => /Invalid prop.*"mode"/.test(String(message)))).toBe(
                true,
            );
            wrapper.unmount();
        } finally {
            warn.mockRestore();
        }
    });

    it("applies invalid state and aria-invalid on the closed trigger", () => {
        const wrapper = mountModel({ models, recommendedModels: [], modelId: null, invalid: true });
        const trigger = wrapper.find(".tr-model-select__trigger");
        expect(trigger.classes()).toContain("is-danger");
        expect(trigger.attributes("aria-invalid")).toBe("true");
        expect(trigger.attributes("aria-expanded")).toBe("false");
    });

    it("does not wrap the search combobox in an outer listbox role", () => {
        // The b-autocomplete owns its own suggestion list (WAI-ARIA combobox
        // pattern); an outer role="listbox" on the dropdown content would
        // nest an editable input inside a listbox, which is invalid ARIA.
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt"],
            modelId: null,
            searchAriaLabel: "Search models",
        });
        const input = wrapper.find(".tr-model-select__popup input");
        expect(input.exists()).toBe(true);
        expect(input.element.closest('[role="listbox"]')).toBeNull();
        expect(input.attributes("aria-label")).toBe("Search models");
        expect(input.attributes("aria-autocomplete")).toBe("list");
    });

    it("renders no component-owned group headers in the open popup", async () => {
        // The component is i18n-neutral: the open popup may only show
        // caller-provided copy and model names, never internal group markers.
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt", "claude"],
            searchResults: [models[2]],
            modelId: null,
        });
        await wrapper.find(".tr-model-select__popup input").trigger("focus");
        await nextTick();
        const popup = wrapper.find(".tr-model-select__popup");
        expect(optionState(wrapper).map((option) => option.name)).toEqual(["GPT", "Claude"]);
        expect(popup.text()).not.toMatch(/__recommended|__search/);

        wrapper.vm.searchQuery = "mis";
        await nextTick();
        await nextTick();
        expect(optionState(wrapper).map((option) => option.name)).toEqual(["Mistral"]);
        expect(popup.text()).not.toMatch(/__recommended|__search/);
        wrapper.unmount();
    });

    it("never renders the BYOK switch row in mode=model", () => {
        const wrapper = mountModel({
            mode: "model",
            models,
            recommendedModels: ["gpt"],
            modelId: null,
            switchLabel: "BYOK",
        });
        expect(wrapper.find(".tr-model-select__switch-row").exists()).toBe(false);
        expect(wrapper.find(".tr-model-select__byok-key").exists()).toBe(false);
    });
});

describe("ModelSelect — open popup loading / empty / error states", () => {
    const labels = {
        emptyLabel: "Nothing found",
        loadingLabel: "Loading models",
        errorLabel: "Could not load models",
    };

    async function openEmptyPopup(props) {
        const wrapper = mountModel({
            models,
            recommendedModels: [],
            searchResults: [],
            modelId: null,
            ...labels,
            ...props,
        });
        await wrapper.find(".tr-model-select__popup input").trigger("focus");
        await nextTick();
        return wrapper;
    }

    function emptyMessage(wrapper) {
        const messages = wrapper.findAll(".tr-model-select__empty");
        expect(messages).toHaveLength(1);
        return messages[0];
    }

    it("shows the caller-provided emptyLabel as a status when idle", async () => {
        const wrapper = await openEmptyPopup({});
        const message = emptyMessage(wrapper);
        expect(message.text()).toBe("Nothing found");
        expect(message.attributes("role")).toBe("status");
        expect(message.attributes("aria-busy")).toBeUndefined();
        wrapper.unmount();
    });

    it("shows the caller-provided loadingLabel with aria-busy while loading", async () => {
        const wrapper = await openEmptyPopup({ loading: true });
        const message = emptyMessage(wrapper);
        expect(message.text()).toBe("Loading models");
        expect(message.attributes("role")).toBe("status");
        expect(message.attributes("aria-busy")).toBe("true");
        expect(wrapper.find(".tr-model-select__popup").text()).not.toContain("Nothing found");
        wrapper.unmount();
    });

    it("shows the caller-provided errorLabel as an alert and gives error priority over loading", async () => {
        const wrapper = await openEmptyPopup({ loading: true, error: true });
        const message = emptyMessage(wrapper);
        expect(message.text()).toBe("Could not load models");
        expect(message.attributes("role")).toBe("alert");
        const popupText = wrapper.find(".tr-model-select__popup").text();
        expect(popupText).not.toContain("Loading models");
        expect(popupText).not.toContain("Nothing found");
        wrapper.unmount();
    });

    it("switches the message when the consumer state changes while open", async () => {
        const wrapper = await openEmptyPopup({ loading: true });
        expect(emptyMessage(wrapper).text()).toBe("Loading models");
        await wrapper.setProps({ loading: false });
        expect(emptyMessage(wrapper).text()).toBe("Nothing found");
        await wrapper.setProps({ error: true });
        expect(emptyMessage(wrapper).text()).toBe("Could not load models");
        wrapper.unmount();
    });
});

describe("ModelSelect — trigger / overlay lifecycle", () => {
    it("emits update:query only on real query changes and never the selected model name", async () => {
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt"],
            searchResults: [models[1]],
            modelId: "gpt",
        });
        const autocomplete = wrapper.findComponent({ name: "BAutocomplete" });

        // Opening with an already empty query is not a query change.
        await openWithArrowDown(wrapper);
        expect(isOpen(wrapper)).toBe(true);
        expect(wrapper.emitted("update:query")).toBeUndefined();

        await autocomplete.find("input").setValue("cl");
        await settle();

        // Go through Buefy's own selection path, which writes into the
        // autocomplete's v-model after emitting `select`.
        autocomplete.vm.setSelected(models[1]);
        await settle();
        expect(isOpen(wrapper)).toBe(false);
        expect(wrapper.emitted("update:modelId")?.at(-1)).toEqual(["claude"]);

        // Reopening after the selection cleared the query emits nothing more.
        await openWithArrowDown(wrapper);
        expect(isOpen(wrapper)).toBe(true);

        expect(wrapper.emitted("update:query")).toEqual([["cl"], [""]]);
        wrapper.unmount();
    });

    it("emits a single empty update:query when reopening after an abandoned search", async () => {
        const wrapper = mountModel({ models, recommendedModels: ["gpt"], modelId: "gpt" });
        await openWithArrowDown(wrapper);
        await wrapper.findComponent({ name: "BAutocomplete" }).find("input").setValue("mis");
        await settle();

        await triggerButton(wrapper).trigger("click");
        await settle();
        expect(isOpen(wrapper)).toBe(false);

        await openWithArrowDown(wrapper);
        expect(isOpen(wrapper)).toBe(true);
        expect(wrapper.emitted("update:query")).toEqual([["mis"], [""]]);
        wrapper.unmount();
    });

    it("opens from the trigger, clears a stale query and focuses the search field", async () => {
        const wrapper = mountModel({ models, recommendedModels: ["gpt"], modelId: "gpt" });
        await triggerButton(wrapper).trigger("click");
        await settle();
        expect(isOpen(wrapper)).toBe(true);
        expect(triggerButton(wrapper).attributes("aria-expanded")).toBe("true");
        const input = wrapper.find(".tr-model-select__popup input");
        expect(document.activeElement).toBe(input.element);

        await input.setValue("mis");
        await settle();
        await triggerButton(wrapper).trigger("click");
        await settle();
        expect(isOpen(wrapper)).toBe(false);

        // Reopen through Buefy's own click toggle (not the ArrowDown path,
        // which resets the query itself): the open lifecycle clears it.
        await triggerButton(wrapper).trigger("click");
        await settle();
        expect(isOpen(wrapper)).toBe(true);
        expect(input.element.value).toBe("");
        expect(wrapper.vm.searchQuery).toBe("");
        expect(document.activeElement).toBe(input.element);
        wrapper.unmount();
    });

    it("marks the selected catalog entry by id, visibly and for assistive tech", async () => {
        // Two entries share a display name; only the one whose id matches
        // v-model:modelId is the selection.
        const catalog = [
            { id: "claude-old", name: "Claude", provider: { icon: "anthropic" } },
            { id: "claude", name: "Claude", provider: { icon: "anthropic" } },
            { id: "gpt", name: "GPT", provider: { icon: "openai" } },
        ];
        const wrapper = mountModel({
            models: catalog,
            recommendedModels: ["claude-old", "claude", "gpt"],
            modelId: "claude",
        });
        await openWithArrowDown(wrapper);
        expect(isOpen(wrapper)).toBe(true);

        expect(optionState(wrapper)).toEqual([
            { name: "Claude", selected: false, current: null, marker: false },
            { name: "Claude", selected: true, current: "true", marker: true },
            { name: "GPT", selected: false, current: null, marker: false },
        ]);
        wrapper.unmount();
    });

    it("keeps modelId and the trigger display when closed without a selection", async () => {
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt"],
            searchResults: [models[2]],
            modelId: "claude",
        });
        await openWithArrowDown(wrapper);
        await wrapper.find(".tr-model-select__popup input").setValue("mis");
        await settle();
        // The transient query never replaces the canonical display.
        expect(triggerValue(wrapper)).toBe("Claude");

        await triggerButton(wrapper).trigger("click");
        await settle();
        expect(isOpen(wrapper)).toBe(false);
        expect(wrapper.emitted("update:modelId")).toBeUndefined();
        expect(triggerValue(wrapper)).toBe("Claude");
        wrapper.unmount();
    });

    it("reopens with ArrowDown after the popup was opened and closed once", async () => {
        const wrapper = mountModel({ models, recommendedModels: ["gpt"], modelId: "gpt" });
        await openWithArrowDown(wrapper);
        expect(isOpen(wrapper)).toBe(true);

        await triggerButton(wrapper).trigger("click");
        await settle();
        expect(isOpen(wrapper)).toBe(false);

        await openWithArrowDown(wrapper);
        expect(isOpen(wrapper)).toBe(true);
        wrapper.unmount();
    });

    it("closes the popup and focuses the trigger when the current model is selected again", async () => {
        const wrapper = mountModel({ models, recommendedModels: ["gpt", "claude"], modelId: "claude" });
        await openWithArrowDown(wrapper);
        expect(isOpen(wrapper)).toBe(true);

        selectOption(wrapper, models[1]);
        await settle();
        expect(isOpen(wrapper)).toBe(false);
        expect(document.activeElement).toBe(triggerButton(wrapper).element);
        wrapper.unmount();
    });

    it("closes on a new selection and survives scroll/resize after a re-render while open", async () => {
        const errors = [];
        const onError = (event) => errors.push(event.error ?? event.message);
        window.addEventListener("error", onError);
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const wrapper = mountModel({ models, recommendedModels: ["gpt", "claude"], modelId: "gpt" });
            await openWithArrowDown(wrapper);
            expect(isOpen(wrapper)).toBe(true);

            // A consumer-driven re-render while open must not swap a component
            // proxy into the element the overlay measures.
            await wrapper.setProps({ invalid: true });
            window.dispatchEvent(new Event("scroll"));
            window.dispatchEvent(new Event("resize"));
            await settle();

            selectOption(wrapper, models[1]);
            await settle();
            expect(wrapper.emitted("update:modelId")?.at(-1)).toEqual(["claude"]);
            expect(isOpen(wrapper)).toBe(false);
            expect(document.activeElement).toBe(triggerButton(wrapper).element);

            window.dispatchEvent(new Event("scroll"));
            window.dispatchEvent(new Event("resize"));
            await settle();

            await openWithArrowDown(wrapper);
            expect(isOpen(wrapper)).toBe(true);
            window.dispatchEvent(new Event("scroll"));
            window.dispatchEvent(new Event("resize"));
            await settle();

            expect(errors).toEqual([]);
            expect(consoleError).not.toHaveBeenCalled();
            wrapper.unmount();
        } finally {
            window.removeEventListener("error", onError);
            consoleError.mockRestore();
        }
    });
});

describe("ModelSelect — BYOK exclusivity, switch and scoped marker", () => {
    const byokScopes = [
        { label: "byok", props: { mode: "byok" } },
        { label: "both + useOwnApiKey", props: { mode: "both", useOwnApiKey: true } },
    ];

    for (const scope of byokScopes) {
        it(`selecting a catalog BYOK entry emits byokModelId and clears providerModelId (${scope.label})`, async () => {
            const wrapper = mountModel({
                ...scope.props,
                models,
                recommendedModels: ["gpt", "claude"],
                modelId: "gpt",
                byokModelId: null,
                providerModelId: "vendor/model-x",
            });
            await openWithArrowDown(wrapper);
            selectOption(wrapper, models[1]);
            await settle();
            expect(wrapper.emitted("update:byokModelId")).toEqual([["claude"]]);
            expect(wrapper.emitted("update:providerModelId")).toEqual([[null]]);
            expect(wrapper.emitted("update:modelId")).toBeUndefined();
            expect(wrapper.emitted("update:useOwnApiKey")).toBeUndefined();
            expect(isOpen(wrapper)).toBe(false);
            wrapper.unmount();
        });
    }

    it("selecting a catalog entry with the switch off emits only update:modelId (both)", async () => {
        const wrapper = mountModel({
            mode: "both",
            useOwnApiKey: false,
            models,
            recommendedModels: ["gpt", "claude"],
            modelId: "gpt",
            byokModelId: "mistral",
            providerModelId: "vendor/model-x",
        });
        await openWithArrowDown(wrapper);
        selectOption(wrapper, models[1]);
        await settle();
        expect(wrapper.emitted("update:modelId")).toEqual([["claude"]]);
        expect(wrapper.emitted("update:byokModelId")).toBeUndefined();
        expect(wrapper.emitted("update:providerModelId")).toBeUndefined();
        wrapper.unmount();
    });

    it("the switch emits only update:useOwnApiKey and keeps hidden ids across scope changes", async () => {
        const wrapper = mountModel({
            mode: "both",
            useOwnApiKey: false,
            models,
            recommendedModels: ["gpt", "claude"],
            modelId: "gpt",
            byokModelId: "claude",
            providerModelId: null,
            switchLabel: "Own key",
        });
        await openWithArrowDown(wrapper);
        const input = wrapper.find(".tr-model-select__switch-input");

        await input.setValue(true);
        await settle();
        expect(wrapper.emitted("update:useOwnApiKey")).toEqual([[true]]);
        await wrapper.setProps({ useOwnApiKey: true });
        expect(triggerValue(wrapper)).toBe("Claude");

        await input.setValue(false);
        await settle();
        expect(wrapper.emitted("update:useOwnApiKey")).toEqual([[true], [false]]);
        await wrapper.setProps({ useOwnApiKey: false });
        expect(triggerValue(wrapper)).toBe("GPT");

        // Switching back and forth with a free-form draft keeps it too.
        await wrapper.setProps({ providerModelId: "vendor/model-x", byokModelId: null });
        await wrapper.setProps({ useOwnApiKey: true });
        expect(triggerValue(wrapper)).toBe("vendor/model-x");
        await wrapper.setProps({ useOwnApiKey: false });
        expect(triggerValue(wrapper)).toBe("GPT");

        expect(wrapper.emitted("update:modelId")).toBeUndefined();
        expect(wrapper.emitted("update:byokModelId")).toBeUndefined();
        expect(wrapper.emitted("update:providerModelId")).toBeUndefined();
        wrapper.unmount();
    });

    it("marks only the id of the active scope (both)", async () => {
        const wrapper = mountModel({
            mode: "both",
            useOwnApiKey: false,
            models,
            recommendedModels: ["gpt", "claude"],
            modelId: "gpt",
            byokModelId: "claude",
        });
        await openWithArrowDown(wrapper);
        const marked = () =>
            optionState(wrapper)
                .filter((option) => option.selected || option.current || option.marker)
                .map((option) => option.name);
        expect(marked()).toEqual(["GPT"]);

        await wrapper.setProps({ useOwnApiKey: true });
        await settle();
        expect(marked()).toEqual(["Claude"]);
        wrapper.unmount();
    });

    it("never marks a catalog entry for a free-form providerModelId, even when it equals a catalog id (byok)", async () => {
        const wrapper = mountModel({
            mode: "byok",
            models,
            recommendedModels: ["gpt", "claude"],
            modelId: "gpt",
            byokModelId: null,
            providerModelId: "claude",
        });
        await openWithArrowDown(wrapper);
        const state = optionState(wrapper);
        expect(state.map((option) => option.name)).toEqual(["GPT", "Claude"]);
        expect(state.every((option) => !option.selected && !option.current && !option.marker)).toBe(true);
        wrapper.unmount();
    });
});


describe("ModelSelect — mode=byok (BYOK only)", () => {
    it("displays the free-form BYOK id on the closed trigger when one is set", () => {
        const wrapper = mountModel({
            mode: "byok",
            models,
            recommendedModels: ["gpt"],
            providerModelId: "openai/gpt-4o-mini",
        });
        // `providerModelId` always wins the closed-trigger display
        // because it is the most recent BYOK commit; catalog selection
        // remains available via `byokModelId`.
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("openai/gpt-4o-mini");
    });

    it("displays the catalog BYOK id when only byokModelId is set", () => {
        const wrapper = mountModel({
            mode: "byok",
            models,
            recommendedModels: ["claude"],
            byokModelId: "claude",
        });
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("Claude");
    });

    it("renders the byok-key slot when provided", () => {
        const wrapper = mountModel(
            {
                mode: "byok",
                models,
                recommendedModels: ["gpt"],
                modelId: null,
            },
            {
                slots: {
                    "byok-key": '<input class="secret-input" type="password">',
                },
            },
        );
        // The package does not look at the rendered input's value;
        // it only forwards the DOM into the public package popup.
        expect(wrapper.find(".tr-model-select__byok-key").exists()).toBe(true);
    });

    it("never renders the BYOK switch row in mode=byok", () => {
        const wrapper = mountModel({
            mode: "byok",
            models,
            recommendedModels: ["gpt"],
            modelId: null,
            switchLabel: "BYOK",
        });
        expect(wrapper.find(".tr-model-select__switch-row").exists()).toBe(false);
    });

    it("falls back to the triggerPlaceholder, not regular modelId, when both BYOK ids are empty (mode=byok)", () => {
        // Regression: in the BYOK scope the trigger must not silently
        // fall back to the regular `modelId`; an empty BYOK draft
        // shows the consumer's `triggerPlaceholder`, never a regular
        // catalog selection.
        const wrapper = mountModel({
            mode: "byok",
            models,
            recommendedModels: ["gpt"],
            modelId: "gpt",
            byokModelId: null,
            providerModelId: null,
            triggerPlaceholder: "Choose a key",
        });
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("Choose a key");
    });

    it("shows an empty string when both BYOK ids are empty and no placeholder is provided (mode=byok)", () => {
        const wrapper = mountModel({
            mode: "byok",
            models,
            recommendedModels: ["gpt"],
            modelId: "gpt",
            byokModelId: null,
            providerModelId: null,
            triggerPlaceholder: "",
        });
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("");
    });
});

describe("ModelSelect — mode=both (mode switch)", () => {
    it("renders the switch row only in mode=both", () => {
        const m = mountModel({
            mode: "model",
            models,
            recommendedModels: ["gpt"],
            modelId: null,
            switchLabel: "Свой ключ",
        });
        expect(m.find(".tr-model-select__switch-row").exists()).toBe(false);
        m.unmount();

        const b = mountModel({
            mode: "both",
            models,
            recommendedModels: ["gpt"],
            modelId: null,
            useOwnApiKey: false,
            switchLabel: "Свой ключ",
        });
        expect(b.find(".tr-model-select__switch-row").exists()).toBe(true);
    });

    it("mirrors useOwnApiKey into the switch checkbox state", () => {
        const wrapper = mountModel({
            mode: "both",
            models,
            recommendedModels: ["gpt"],
            modelId: null,
            useOwnApiKey: true,
            switchLabel: "BYOK",
        });
        const input = wrapper.find(".tr-model-select__switch-input");
        expect(input.attributes("checked")).toBeDefined();
    });

    it("scope in mode=both tracks useOwnApiKey for canonical display", async () => {
        const wrapper = mountModel({
            mode: "both",
            models,
            recommendedModels: ["claude"],
            modelId: "gpt",
            byokModelId: "claude",
            useOwnApiKey: false,
            switchLabel: "BYOK",
        });
        // Regular scope reads modelId.
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("GPT");
        // Flip to BYOK: canonical display reads byokModelId, not
        // modelId — modelId stays bound to the consumer.
        await wrapper.setProps({ useOwnApiKey: true });
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("Claude");
    });

    it("BYOK scope with both BYOK ids empty shows the triggerPlaceholder, not modelId (mode=both)", async () => {
        // Regression: with `useOwnApiKey === true` the active scope is
        // BYOK; an empty BYOK draft must surface the placeholder, not
        // silently display the regular catalog selection.
        const wrapper = mountModel({
            mode: "both",
            models,
            recommendedModels: ["claude"],
            modelId: "gpt",
            byokModelId: null,
            providerModelId: null,
            useOwnApiKey: true,
            switchLabel: "BYOK",
            triggerPlaceholder: "Choose a key",
        });
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("Choose a key");
        await wrapper.setProps({ useOwnApiKey: false });
        // Flipping back to the regular scope re-exposes modelId.
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("GPT");
    });
});

describe("ModelSelect — free-form BYOK action", () => {
    const freeformLabels = {
        freeformActionLabel: "Use {id}",
        freeformErrorLabel: "Invalid model id",
        freeformHint: "Press Enter to use this id",
    };

    async function settle() {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Any render/computed error (e.g. a ReferenceError from an
    // unresolved identifier) must fail the test instead of being
    // swallowed by Vue's default handler.
    function strictGlobal(errors) {
        return {
            config: {
                errorHandler: (err) => {
                    errors.push(err);
                    throw err;
                },
            },
        };
    }

    async function typeQuery(props, query, errors) {
        const wrapper = mountModel(
            {
                models,
                recommendedModels: [],
                searchResults: [],
                ...freeformLabels,
                ...props,
            },
            { global: strictGlobal(errors) },
        );
        await wrapper.find("button.tr-model-select__trigger").trigger("keydown", { key: "ArrowDown" });
        await settle();
        await wrapper.findComponent({ name: "BAutocomplete" }).find("input").setValue(query);
        await settle();
        return wrapper;
    }

    // Keyboard path: Buefy's autocomplete closes on Tab/Escape, its
    // arrows walk an empty list, and Enter with nothing hovered selects
    // nothing, so Enter in the search input must commit the free-form id.
    async function pressEnter(wrapper) {
        await wrapper
            .findComponent({ name: "BAutocomplete" })
            .find("input")
            .trigger("keydown", { key: "Enter" });
        await settle();
    }

    for (const props of [{ mode: "byok" }, { mode: "both", useOwnApiKey: true }]) {
        it(`offers a valid trimmed id with the formatted label (${props.mode})`, async () => {
            const errors = [];
            const wrapper = await typeQuery(props, "  vendor/model-x  ", errors);
            const action = wrapper.find(".tr-model-select__freeform-action");
            expect(action.exists()).toBe(true);
            expect(action.text()).toBe("Use vendor/model-x");
            expect(action.attributes("disabled")).toBeUndefined();
            expect(wrapper.find(".tr-model-select__freeform-hint").text()).toBe(
                freeformLabels.freeformHint,
            );
            expect(errors).toEqual([]);
            wrapper.unmount();
        });

        it(`disables the action and shows freeformErrorLabel for an id with whitespace (${props.mode})`, async () => {
            const errors = [];
            const wrapper = await typeQuery(props, "vendor model", errors);
            const action = wrapper.find(".tr-model-select__freeform-action");
            expect(action.exists()).toBe(true);
            expect(action.attributes("disabled")).toBeDefined();
            expect(action.attributes("title")).toBe(freeformLabels.freeformErrorLabel);
            expect(wrapper.find(".tr-model-select__freeform-hint").text()).toBe(
                freeformLabels.freeformErrorLabel,
            );
            expect(errors).toEqual([]);
            wrapper.unmount();
        });

        it(`disables the action and shows freeformErrorLabel for an id over 255 chars (${props.mode})`, async () => {
            const errors = [];
            const wrapper = await typeQuery(props, "m".repeat(256), errors);
            const action = wrapper.find(".tr-model-select__freeform-action");
            expect(action.exists()).toBe(true);
            expect(action.attributes("disabled")).toBeDefined();
            expect(wrapper.find(".tr-model-select__freeform-hint").text()).toBe(
                freeformLabels.freeformErrorLabel,
            );
            expect(errors).toEqual([]);
            wrapper.unmount();
        });

        it(`Enter in the search input commits a valid free-form id (${props.mode})`, async () => {
            const errors = [];
            const wrapper = await typeQuery(
                { ...props, modelId: "gpt", byokModelId: "claude" },
                "  vendor/model-x  ",
                errors,
            );
            await pressEnter(wrapper);
            expect(wrapper.emitted("update:providerModelId")).toEqual([["vendor/model-x"]]);
            expect(wrapper.emitted("update:byokModelId")).toEqual([[null]]);
            expect(wrapper.emitted("update:modelId")).toBeUndefined();
            expect(errors).toEqual([]);
            wrapper.unmount();
        });

        it(`Enter in the search input ignores an invalid free-form id (${props.mode})`, async () => {
            const errors = [];
            const wrapper = await typeQuery({ ...props, byokModelId: "claude" }, "vendor model", errors);
            await pressEnter(wrapper);
            expect(wrapper.emitted("update:providerModelId")).toBeUndefined();
            expect(wrapper.emitted("update:byokModelId")).toBeUndefined();
            expect(wrapper.emitted("update:modelId")).toBeUndefined();
            expect(errors).toEqual([]);
            wrapper.unmount();
        });

        for (const status of ["loading", "error"]) {
            it(`Enter in the search input does not commit while ${status} (${props.mode})`, async () => {
                const errors = [];
                const wrapper = await typeQuery(
                    { ...props, byokModelId: "claude", [status]: true },
                    "vendor/model-x",
                    errors,
                );
                expect(wrapper.find(".tr-model-select__freeform-action").exists()).toBe(false);
                await pressEnter(wrapper);
                expect(wrapper.emitted("update:providerModelId")).toBeUndefined();
                expect(wrapper.emitted("update:byokModelId")).toBeUndefined();
                expect(errors).toEqual([]);
                wrapper.unmount();
            });
        }
    }

    it("Enter in the search input never commits free-form in mode=model", async () => {
        const errors = [];
        const wrapper = await typeQuery({ mode: "model" }, "vendor/model-x", errors);
        await pressEnter(wrapper);
        expect(wrapper.emitted("update:providerModelId")).toBeUndefined();
        expect(wrapper.emitted("update:byokModelId")).toBeUndefined();
        expect(wrapper.emitted("update:modelId")).toBeUndefined();
        expect(errors).toEqual([]);
        wrapper.unmount();
    });

    // Regression: validation must reject invalid ids even when the
    // consumer does not supply `freeformErrorLabel`. Validity is a
    // package invariant; the visible text is the only thing the
    // consumer copy gates, and the package ships no built-in copy.
    describe("without freeformErrorLabel", () => {
        for (const props of [{ mode: "byok" }, { mode: "both", useOwnApiKey: true }]) {
            it(`still disables the action for an id with whitespace (${props.mode})`, async () => {
                const errors = [];
                const wrapper = await typeQuery(
                    {
                        ...props,
                        freeformActionLabel: "Use {id}",
                        freeformErrorLabel: "",
                        freeformHint: "",
                    },
                    "vendor model",
                    errors,
                );
                const action = wrapper.find(".tr-model-select__freeform-action");
                expect(action.exists()).toBe(true);
                expect(action.attributes("disabled")).toBeDefined();
                // The package itself ships no built-in error text — both
                // the action's `title` attribute and the visible hint
                // slot fall back to the empty string in this configuration.
                expect(action.attributes("title")).toBe("");
                expect(wrapper.find(".tr-model-select__freeform-hint").exists()).toBe(false);
                // Pressing Enter must NOT commit a new providerModelId.
                await pressEnter(wrapper);
                expect(wrapper.emitted("update:providerModelId")).toBeUndefined();
                expect(wrapper.emitted("update:byokModelId")).toBeUndefined();
                expect(errors).toEqual([]);
                wrapper.unmount();
            });

            it(`still disables the action for an id over 255 chars (${props.mode})`, async () => {
                const errors = [];
                const wrapper = await typeQuery(
                    {
                        ...props,
                        freeformActionLabel: "Use {id}",
                        freeformErrorLabel: "",
                        freeformHint: "",
                    },
                    "m".repeat(256),
                    errors,
                );
                const action = wrapper.find(".tr-model-select__freeform-action");
                expect(action.exists()).toBe(true);
                expect(action.attributes("disabled")).toBeDefined();
                expect(action.attributes("title")).toBe("");
                expect(wrapper.find(".tr-model-select__freeform-hint").exists()).toBe(false);
                await pressEnter(wrapper);
                expect(wrapper.emitted("update:providerModelId")).toBeUndefined();
                expect(wrapper.emitted("update:byokModelId")).toBeUndefined();
                expect(errors).toEqual([]);
                wrapper.unmount();
            });
        }
    });
});

describe("ModelSelect — package boundary (no Vue Router / no Pinia)", () => {
    it("renders in all three modes without importing vue-router or pinia", async () => {
        for (const mode of ["model", "byok", "both"]) {
            const wrapper = mountModel({
                mode,
                models,
                recommendedModels: ["gpt"],
                modelId: null,
                useOwnApiKey: false,
            });
            await nextTick();
            expect(wrapper.exists()).toBe(true);
            wrapper.unmount();
        }
    });
});
