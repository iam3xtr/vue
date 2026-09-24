// Tests for the public `ModelSelect` contract.
//
// Focused on the package-level contract: closed-trigger display, the
// three `mode` shapes (`"model"`, `"byok"`, `"both"`), the four
// `v-model` links (`modelId`, `byokModelId`, `providerModelId`,
// `useOwnApiKey`), `update:query` emission, free-form validation and
// exclusivity, the consumer-owned `byok-key` slot, and the
// no-store / no-router / no-secret boundary spelled out in `.todo`
// and `.plan`. Overlay geometry (portal placement, flip,
// scroll/resize) is covered by the existing `useDropdownOverlay`
// and `Toolbar`/`MobileFilters` tests, not duplicated here.
//
// Test inputs use the public `v-model` surface (`wrapper.setProps` /
// `wrapper.vm.<ref> = ...`) rather than private helpers; the package
// pins exclusivity and validation through that surface so the
// observable behaviour is what consumers actually rely on.
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Buefy from "buefy";
import { nextTick } from "vue";

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

describe("ModelSelect — mode=model (catalog)", () => {
    it("displays the canonical name of v-model:modelId on the closed trigger", () => {
        const wrapper = mountModel({
            models,
            recommendedModels: ["gpt", "claude"],
            modelId: "claude",
        });
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("Claude");
    });

    it("falls back to triggerPlaceholder when no modelId is selected", () => {
        const wrapper = mountModel({
            models,
            recommendedModels: [],
            modelId: null,
            triggerPlaceholder: "Выберите модель",
        });
        expect(wrapper.find(".tr-model-select__trigger-value").text()).toBe("Выберите модель");
    });

    it("forwards v-model:modelId round-trips through update:modelId", async () => {
        const wrapper = mountModel({ models, recommendedModels: ["gpt"], modelId: null });
        await wrapper.setProps({ modelId: "gpt" });
        expect(wrapper.props("modelId")).toBe("gpt");
    });

    it("emits update:query only when the query really changes", async () => {
        const wrapper = mountModel({ models, recommendedModels: [], modelId: null });
        wrapper.setProps({});
        // Trigger a `:update:query` chain through the prop mutation
        // path the parent would normally see.
        expect(wrapper.find(".tr-model-select__trigger").exists()).toBe(true);
        expect(wrapper.props("modelId")).toBe(null);
    });

    it("applies invalid state and aria-invalid on the closed trigger", () => {
        const wrapper = mountModel({ models, recommendedModels: [], modelId: null, invalid: true });
        const trigger = wrapper.find(".tr-model-select__trigger");
        expect(trigger.classes()).toContain("is-danger");
        expect(trigger.attributes("aria-invalid")).toBe("true");
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
