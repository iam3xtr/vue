// Tests for the public `MessageComposer` contract (Stage 3, task 2).
//
// Focused on the keyboard / IME / disabled / busy submit semantics
// documented in `.todo`: Enter (no Shift) emits `submit` with the
// trimmed non-empty draft, Shift+Enter inserts a newline without
// emitting `submit`, IME composition suppresses the emit, the
// textarea and button are inert while `disabled` or `busy`, the
// submit button fires the same emit, and the component never clears
// the consumer's v-model itself. Auto-grow geometry and visual
// contract are covered separately by task 3.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

import MessageComposer from "../src/components/MessageComposer.vue";

function mountComposer(props = {}, opts = {}) {
    return mount(MessageComposer, {
        props,
        slots: opts.slots,
        attachTo: opts.attach ?? document.body,
    });
}

function textarea(wrapper) {
    return wrapper.find("textarea.tr-message-composer__textarea");
}

function submitButton(wrapper) {
    return wrapper.find("button.tr-message-composer__submit");
}

async function typeInto(wrapper, text) {
    const ta = textarea(wrapper);
    await ta.setValue(text);
    await nextTick();
}

describe("MessageComposer — controlled draft and submit guards", () => {
    it("emits update:modelValue with the raw typed value", async () => {
        const wrapper = mountComposer({ modelValue: "" });
        await typeInto(wrapper, "hello");
        expect(wrapper.emitted("update:modelValue")).toEqual([["hello"]]);
        wrapper.unmount();
    });

    it("Enter (no Shift) emits submit with the trimmed draft and suppresses the newline", async () => {
        const wrapper = mountComposer({ modelValue: "  hi there  " });
        await textarea(wrapper).trigger("keydown", { key: "Enter" });
        expect(wrapper.emitted("submit")).toEqual([["hi there"]]);
        // The consumer's modelValue stays unchanged; the package does not
        // own draft clearing.
        expect(wrapper.props("modelValue")).toBe("  hi there  ");
        wrapper.unmount();
    });

    it("Shift+Enter inserts a newline and does not emit submit", async () => {
        const wrapper = mountComposer({ modelValue: "" });
        await textarea(wrapper).trigger("keydown", { key: "Enter", shiftKey: true });
        expect(wrapper.emitted("submit")).toBeUndefined();
        wrapper.unmount();
    });

    it("Enter with an empty trimmed draft does not emit submit", async () => {
        const wrapper = mountComposer({ modelValue: "   " });
        await textarea(wrapper).trigger("keydown", { key: "Enter" });
        expect(wrapper.emitted("submit")).toBeUndefined();
        wrapper.unmount();
    });

    it("Enter does not emit submit while IME composition is active", async () => {
        // Bind v-model so the typed draft flows back into `modelValue`;
        // otherwise the draft stays empty and the IME guard is never the
        // reason `submit` is suppressed.
        const wrapper = mountComposer({
            modelValue: "",
            "onUpdate:modelValue": (value) => wrapper.setProps({ modelValue: value }),
        });
        const ta = textarea(wrapper);
        await ta.setValue("にほん");
        expect(wrapper.props("modelValue")).toBe("にほん");
        await ta.trigger("compositionstart");
        await ta.trigger("keydown", { key: "Enter" });
        expect(wrapper.emitted("submit")).toBeUndefined();
        await ta.trigger("compositionend");
        await ta.trigger("keydown", { key: "Enter" });
        expect(wrapper.emitted("submit")).toEqual([["にほん"]]);
        wrapper.unmount();
    });

    it("ignores the Safari/WebKit IME-confirm Enter that arrives after compositionend (keyCode 229)", async () => {
        // WebKit fires `compositionend` before the `keydown` of the Enter
        // that confirms the IME candidate; that keydown reports
        // `isComposing === false` but `keyCode === 229`.
        const wrapper = mountComposer({
            modelValue: "",
            "onUpdate:modelValue": (value) => wrapper.setProps({ modelValue: value }),
        });
        const ta = textarea(wrapper);
        await ta.setValue("にほん");
        await ta.trigger("compositionstart");
        await ta.trigger("compositionend");
        const imeEnter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
        Object.defineProperty(imeEnter, "keyCode", { value: 229 });
        ta.element.dispatchEvent(imeEnter);
        await nextTick();
        expect(wrapper.emitted("submit")).toBeUndefined();
        // The IME owns this keystroke; the composer must not cancel it.
        expect(imeEnter.defaultPrevented).toBe(false);

        const plainEnter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
        Object.defineProperty(plainEnter, "keyCode", { value: 13 });
        ta.element.dispatchEvent(plainEnter);
        await nextTick();
        expect(wrapper.emitted("submit")).toEqual([["にほん"]]);
        expect(plainEnter.defaultPrevented).toBe(true);
        wrapper.unmount();
    });

    it("Enter does not emit submit while disabled", async () => {
        const wrapper = mountComposer({ modelValue: "hi", disabled: true });
        await textarea(wrapper).trigger("keydown", { key: "Enter" });
        expect(wrapper.emitted("submit")).toBeUndefined();
        expect(submitButton(wrapper).attributes("disabled")).toBeDefined();
        wrapper.unmount();
    });

    it("Enter does not emit submit while busy; aria-busy is on the textarea", async () => {
        const wrapper = mountComposer({ modelValue: "hi", busy: true });
        const ta = textarea(wrapper);
        expect(ta.attributes("aria-busy")).toBe("true");
        await ta.trigger("keydown", { key: "Enter" });
        expect(wrapper.emitted("submit")).toBeUndefined();
        expect(submitButton(wrapper).attributes("disabled")).toBeDefined();
        wrapper.unmount();
    });

    it("the submit button emits submit when clicked with a valid draft", async () => {
        const wrapper = mountComposer({ modelValue: "hello" });
        await submitButton(wrapper).trigger("click");
        expect(wrapper.emitted("submit")).toEqual([["hello"]]);
        wrapper.unmount();
    });

    it("the submit button does not emit submit with an empty trimmed draft", async () => {
        const wrapper = mountComposer({ modelValue: "   " });
        await submitButton(wrapper).trigger("click");
        expect(wrapper.emitted("submit")).toBeUndefined();
        wrapper.unmount();
    });

    it("does not mutate the consumer's modelValue on submit (controlled draft)", async () => {
        const wrapper = mountComposer({ modelValue: "draft text" });
        await submitButton(wrapper).trigger("click");
        // No update:modelValue emission triggered by the package itself.
        expect(wrapper.emitted("update:modelValue")).toBeUndefined();
        expect(wrapper.props("modelValue")).toBe("draft text");
        wrapper.unmount();
    });
});

describe("MessageComposer — accessible-name wiring and slot", () => {
    it("forwards consumer placeholder/aria-label/submitAriaLabel/textareaAriaLabel to the right nodes", () => {
        const wrapper = mountComposer({
            modelValue: "",
            placeholder: "Write a message",
            textareaAriaLabel: "Message body",
            submitAriaLabel: "Send",
            ariaLabel: "Composer",
        });
        const ta = textarea(wrapper);
        expect(ta.attributes("placeholder")).toBe("Write a message");
        expect(ta.attributes("aria-label")).toBe("Message body");
        expect(submitButton(wrapper).attributes("aria-label")).toBe("Send");
        expect(wrapper.find("form.tr-message-composer").attributes("aria-label")).toBe("Composer");
        wrapper.unmount();
    });

    it("renders the default submit glyph when no submit-icon slot is provided", () => {
        const wrapper = mountComposer({ modelValue: "hi" });
        const btn = submitButton(wrapper);
        expect(btn.text()).toContain("➤");
        wrapper.unmount();
    });

    it("renders a consumer-supplied submit-icon slot", () => {
        const wrapper = mountComposer(
            { modelValue: "hi" },
            { slots: { "submit-icon": '<svg class="my-icon" data-icon="send" />' } },
        );
        const btn = submitButton(wrapper);
        expect(btn.find("svg.my-icon").exists()).toBe(true);
        // Default glyph is replaced, not duplicated.
        expect(btn.text()).not.toContain("➤");
        wrapper.unmount();
    });
});

describe("MessageComposer — package boundary", () => {
    it("renders without Buefy installed", () => {
        const wrapper = mountComposer({ modelValue: "" });
        expect(wrapper.find(".tr-message-composer").exists()).toBe(true);
        expect(wrapper.find(".tr-message-composer__textarea").exists()).toBe(true);
        expect(wrapper.find(".tr-message-composer__submit").exists()).toBe(true);
        wrapper.unmount();
    });
});

describe("MessageComposer — auto-grow geometry (task 3)", () => {
    // `autosize` defers the measurement to `requestAnimationFrame`.
    // Queue the callbacks and flush them explicitly so the tests do
    // not depend on jsdom's frame timing.
    let rafQueue;
    beforeEach(() => {
        rafQueue = [];
        vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
            rafQueue.push(cb);
            return rafQueue.length;
        });
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function flushFrames() {
        await nextTick();
        const pending = rafQueue.splice(0);
        pending.forEach((cb) => cb(0));
    }

    function stubScrollHeight(ta, value) {
        Object.defineProperty(ta, "scrollHeight", { configurable: true, get: () => value });
    }

    it("measures on mount and resets the textarea height to 'auto' before reading scrollHeight", async () => {
        const wrapper = mountComposer({ modelValue: "hello" });
        const ta = wrapper.find("textarea").element;
        // Record the inline height at the moment scrollHeight is read:
        // without the `auto` reset, scrollHeight would be capped at the
        // previous inline height and growth would be missed.
        ta.style.height = "300px";
        let heightAtRead = null;
        Object.defineProperty(ta, "scrollHeight", {
            configurable: true,
            get: () => {
                heightAtRead = ta.style.height;
                return 30;
            },
        });
        await flushFrames();
        expect(heightAtRead).toBe("auto");
        expect(ta.style.height).toBe("30px");
        wrapper.unmount();
    });

    it("writes the natural scrollHeight back as the new inline height", async () => {
        const wrapper = mountComposer({ modelValue: "hello" });
        const ta = wrapper.find("textarea").element;
        await flushFrames();
        stubScrollHeight(ta, 42);
        await wrapper.setProps({ modelValue: "hello world" });
        await flushFrames();
        expect(ta.style.height).toBe("42px");
        wrapper.unmount();
    });

    it("resizes on every external modelValue change (controlled reset)", async () => {
        const wrapper = mountComposer({ modelValue: "hello" });
        const ta = wrapper.find("textarea").element;
        stubScrollHeight(ta, 18);
        await flushFrames();
        expect(ta.style.height).toBe("18px");

        stubScrollHeight(ta, 96);
        await wrapper.setProps({ modelValue: "hello\nworld\nfoo\nbar\nbaz" });
        await flushFrames();
        expect(ta.style.height).toBe("96px");

        // Clearing the draft shrinks the textarea back to the single-line
        // height the package stylesheet reserves.
        stubScrollHeight(ta, 18);
        await wrapper.setProps({ modelValue: "" });
        await flushFrames();
        expect(ta.style.height).toBe("18px");
        wrapper.unmount();
    });

    it("adds the border-box frame (offsetHeight - clientHeight) so a fitting draft never shows a scrollbar", async () => {
        // The package theme sizes the textarea as `border-box`, while
        // `scrollHeight` excludes borders. Writing `scrollHeight` alone
        // leaves the box 2px short of its content and scrolls from the
        // second line on. The max-height / overflow-y cap itself is a
        // `@iam3xtr/ui` style contract pinned in that package's tests.
        const wrapper = mountComposer({ modelValue: "hello" });
        const ta = wrapper.find("textarea").element;
        Object.defineProperty(ta, "offsetHeight", { configurable: true, get: () => 42 });
        Object.defineProperty(ta, "clientHeight", { configurable: true, get: () => 40 });
        stubScrollHeight(ta, 40);
        await wrapper.setProps({ modelValue: "hello world" });
        await flushFrames();
        expect(ta.style.height).toBe("42px");
        wrapper.unmount();
    });
});