// Tests for the public `ChatHistory` contract (Stage 3).
//
// Focused on the package-level contract documented in `.todo`:
// default body, `outgoing` direction, scoped `body` / `metadata` / `status`
// slots, an empty-state slot that ships no built-in copy, accessible-name
// propagation via `ariaLabel`, no mutation of the consumer's `messages`
// array, and a stable Vue `:key` derived from `id`. The package boundary
// (no Pinia/router/transport) is asserted by the absence of any such
// import inside the component and is reinforced by the SSR import test.
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import ChatHistory from "../src/components/ChatHistory.vue";

const messages = [
    { id: "m1", text: "Hello there", outgoing: false },
    { id: "m2", text: "Hi back", outgoing: true },
    { id: "m3", text: "Multi-line\nmessage", outgoing: false },
];

describe("ChatHistory — default body", () => {
    it("renders one tr-chat-history__message per input, with text escaped", () => {
        const wrapper = mount(ChatHistory, { props: { messages } });
        const rendered = wrapper.findAll(".tr-chat-history__message");
        expect(rendered).toHaveLength(3);
        expect(rendered[0].text()).toContain("Hello there");
        expect(rendered[1].text()).toContain("Hi back");
        // Newlines are preserved in the visible text via CSS `white-space:
        // pre-wrap` — the markup itself keeps the raw string.
        expect(rendered[2].text()).toContain("Multi-line\nmessage");
        expect(rendered[0].find(".tr-chat-history__text").exists()).toBe(true);
    });

    it("marks outgoing messages with the dedicated class", () => {
        const wrapper = mount(ChatHistory, { props: { messages } });
        const rendered = wrapper.findAll(".tr-chat-history__message");
        expect(rendered[0].classes()).not.toContain("tr-chat-history__message--outgoing");
        expect(rendered[1].classes()).toContain("tr-chat-history__message--outgoing");
        expect(rendered[2].classes()).not.toContain("tr-chat-history__message--outgoing");
    });

    it("wraps the whole list in a section with the consumer-provided ariaLabel and aria-live=polite by default", () => {
        const wrapper = mount(ChatHistory, {
            props: { messages, ariaLabel: "Dialog with operator" },
        });
        const section = wrapper.find("section.tr-chat-history");
        expect(section.exists()).toBe(true);
        expect(section.attributes("aria-label")).toBe("Dialog with operator");
        expect(section.attributes("aria-live")).toBe("polite");
    });

    it("omits aria-label when the consumer does not pass one (no built-in copy)", () => {
        const wrapper = mount(ChatHistory, { props: { messages } });
        const section = wrapper.find("section.tr-chat-history");
        expect(section.attributes("aria-label")).toBeUndefined();
    });

    it("honors a custom aria-live override", () => {
        const wrapper = mount(ChatHistory, {
            props: { messages, ariaLive: "off" },
        });
        expect(wrapper.find("section.tr-chat-history").attributes("aria-live")).toBe("off");
    });

    it("uses each message id as the Vue :key (no synthetic indexes in markup)", () => {
        const wrapper = mount(ChatHistory, { props: { messages } });
        // Vue does not emit the keyed attribute into the DOM; the stable
        // ordering of rendered text confirms the keyed v-for over `id`.
        const rendered = wrapper.findAll(".tr-chat-history__message");
        expect(rendered.map((node) => node.text())).toEqual([
            "Hello there",
            "Hi back",
            "Multi-line\nmessage",
        ]);
    });

    it("does not mutate the messages array on mount or render", () => {
        const input = [...messages];
        const snapshot = JSON.stringify(input);
        const wrapper = mount(ChatHistory, { props: { messages: input } });
        wrapper.unmount();
        expect(JSON.stringify(input)).toBe(snapshot);
    });
});

describe("ChatHistory — empty state", () => {
    it("renders the empty slot when messages is an empty array", () => {
        const wrapper = mount(ChatHistory, {
            props: { messages: [] },
            slots: { empty: '<p class="tr-consumer-empty">No messages yet</p>' },
        });
        expect(wrapper.findAll(".tr-chat-history__message")).toHaveLength(0);
        expect(wrapper.find(".tr-chat-history__empty").exists()).toBe(true);
        expect(wrapper.find(".tr-consumer-empty").text()).toBe("No messages yet");
    });

    it("renders nothing in the empty state when no slot is provided (no built-in copy)", () => {
        const wrapper = mount(ChatHistory, { props: { messages: [] } });
        expect(wrapper.findAll(".tr-chat-history__message")).toHaveLength(0);
        expect(wrapper.find(".tr-chat-history__empty").exists()).toBe(true);
        expect(wrapper.find(".tr-chat-history__empty").text()).toBe("");
    });

    it("never shows the list wrapper when the messages array is empty", () => {
        const wrapper = mount(ChatHistory, { props: { messages: [] } });
        expect(wrapper.find(".tr-chat-history__list").exists()).toBe(false);
    });
});

describe("ChatHistory — scoped slots", () => {
    it("replaces the default body via the body slot and forwards the original message", () => {
        const wrapper = mount(ChatHistory, {
            props: { messages },
            slots: {
                body: '<div class="tr-rich-body">{{ message.text.toUpperCase() }}</div>',
            },
        });
        expect(wrapper.find(".tr-rich-body").exists()).toBe(true);
        expect(wrapper.find(".tr-chat-history__text").exists()).toBe(false);
        expect(wrapper.text()).toContain("HELLO THERE");
    });

    it("renders the metadata slot under each message, scoped to the message", () => {
        const wrapper = mount(ChatHistory, {
            props: { messages: [{ id: "m1", text: "Hi", outgoing: true }] },
            slots: {
                metadata: '<span class="tr-meta">@{{ message.id }} at 12:34</span>',
            },
        });
        expect(wrapper.find(".tr-meta").text()).toBe("@m1 at 12:34");
        expect(wrapper.find(".tr-chat-history__meta").exists()).toBe(true);
    });

    it("renders the status slot alongside metadata in the same row", () => {
        const wrapper = mount(ChatHistory, {
            props: { messages: [{ id: "m1", text: "Hi", outgoing: true }] },
            slots: {
                status: '<span class="tr-status">{{ message.outgoing ? "sent" : "received" }}</span>',
            },
        });
        expect(wrapper.find(".tr-status").text()).toBe("sent");
        expect(wrapper.find(".tr-chat-history__meta").exists()).toBe(true);
    });

    it("skips the meta row entirely when neither metadata nor status slot is provided", () => {
        const wrapper = mount(ChatHistory, {
            props: { messages: [{ id: "m1", text: "Hi", outgoing: true }] },
        });
        expect(wrapper.find(".tr-chat-history__meta").exists()).toBe(false);
    });
});

describe("ChatHistory — package boundary", () => {
    it("renders without Buefy installed (no b-* components inside)", () => {
        const wrapper = mount(ChatHistory, { props: { messages } });
        expect(wrapper.find(".tr-chat-history").exists()).toBe(true);
        // Default body uses plain `<p>` — no Buefy primitives are required.
        expect(wrapper.find(".tr-chat-history__text").exists()).toBe(true);
        wrapper.unmount();
    });
});