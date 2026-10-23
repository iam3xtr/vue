import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import ChannelTypeIcon from "../src/components/ChannelTypeIcon.vue";
import { CHANNEL_TYPES, CHANNEL_TYPE_SYMBOLS } from "../src/channel-type.js";

const FakeBIcon = {
  name: "BIcon",
  props: { icon: { type: String, default: null } },
  template: '<span class="icon"><i :data-icon="icon"></i></span>',
};
const opts = (props) => ({ props, global: { components: { BIcon: FakeBIcon } } });

describe("ChannelTypeIcon", () => {
  it("maps six distinct kinds to distinct symbols", () => {
    const symbols = CHANNEL_TYPES.map((t) => CHANNEL_TYPE_SYMBOLS[t]);
    expect(new Set(symbols).size).toBe(6);
  });

  it("every non-registry symbol resolves in the installed @mdi/font", () => {
    const css = readFileSync(createRequire(import.meta.url).resolve("@mdi/font/css/materialdesignicons.css"), "utf8");
    for (const symbol of Object.values(CHANNEL_TYPE_SYMBOLS)) {
      if (symbol === "channel-max") continue;
      expect(css, symbol).toContain(`.mdi-${symbol}::before`);
    }
  });

  it("max symbol differs from the unknown fallback", () => {
    expect(CHANNEL_TYPE_SYMBOLS.max).not.toBe(CHANNEL_TYPE_SYMBOLS.unknown);
  });

  it("icon-only known type is a named image", () => {
    const w = mount(ChannelTypeIcon, opts({ type: "telegram", label: "Telegram" }));
    expect(w.attributes("role")).toBe("img");
    expect(w.attributes("aria-label")).toBe("Telegram");
    expect(w.attributes("tabindex")).toBeUndefined();
    expect(w.find("[data-icon]").attributes("data-icon")).toBe("send");
  });

  it("normalizes case and whitespace", () => {
    const w = mount(ChannelTypeIcon, opts({ type: " Web ", label: "Web" }));
    expect(w.classes()).toContain("tr-channel-type--web");
  });

  it("decorative or unlabelled known icons are aria-hidden-safe", () => {
    const d = mount(ChannelTypeIcon, opts({ type: "widget", label: "Widget", decorative: true }));
    expect(d.attributes("aria-hidden")).toBe("true");
    expect(d.attributes("role")).toBeUndefined();
    const n = mount(ChannelTypeIcon, opts({ type: "widget" }));
    expect(n.attributes("role")).toBeUndefined();
  });

  it("unknown or missing type shows neutral symbol plus escaped text, never another logo", () => {
    const w = mount(ChannelTypeIcon, opts({ type: "<img src=x onerror=1>" }));
    expect(w.find("img").exists()).toBe(false);
    expect(w.text()).toBe("<img src=x onerror=1>");
    expect(w.find("[data-icon]").attributes("data-icon")).toBe("help-circle-outline");
    expect(w.attributes("role")).toBeUndefined();
    const u = mount(ChannelTypeIcon, opts({ type: "unknown", label: "Other" }));
    expect(u.text()).toBe("Other");
    expect(mount(ChannelTypeIcon, opts({ type: null, label: "Not set" })).text()).toBe("Not set");
  });

  it("max uses the registry symbol, not a Buefy/MDI name", () => {
    const w = mount(ChannelTypeIcon, { props: { type: "max", label: "MAX" } });
    expect(w.find("svg").exists()).toBe(true);
  });

  it("size and variant classes", () => {
    const w = mount(ChannelTypeIcon, opts({ type: "email", size: "header", variant: "brand" }));
    expect(w.classes()).toEqual(expect.arrayContaining(["tr-channel-type--header", "tr-channel-type--brand"]));
  });

  it("server-renders without Buefy or Router", async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(ChannelTypeIcon, { type: "max", label: "MAX" }) }),
    );
    expect(html).toContain('aria-label="MAX"');
  });
});
