import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Buefy from "buefy";

import AsyncState from "../src/components/AsyncState.vue";
import ListAsyncState from "../src/components/ListAsyncState.vue";

const global_ = { plugins: [Buefy] };

describe("AsyncState", () => {
  it("loading variant renders the Loader and sets neither role nor aria-live", () => {
    const wrapper = mount(AsyncState, { props: { variant: "loading" }, global: global_ });
    expect(wrapper.find(".tr-loader").exists()).toBe(true);
    expect(wrapper.attributes("role")).toBeUndefined();
    expect(wrapper.attributes("aria-live")).toBeUndefined();
  });

  it("error variant is an alert announced assertively", () => {
    const wrapper = mount(AsyncState, {
      props: { variant: "error", title: "Oops", message: "Try again" },
      global: global_,
    });
    expect(wrapper.attributes("role")).toBe("alert");
    expect(wrapper.attributes("aria-live")).toBe("assertive");
    expect(wrapper.text()).toContain("Oops");
    expect(wrapper.text()).toContain("Try again");
  });

  it("non-error, non-loading variants are a polite status", () => {
    const wrapper = mount(AsyncState, { props: { variant: "empty" }, global: global_ });
    expect(wrapper.attributes("role")).toBe("status");
    expect(wrapper.attributes("aria-live")).toBe("polite");
  });

  it("renders the default slot as actions only when content is provided", () => {
    const wrapper = mount(AsyncState, {
      props: { variant: "empty" },
      slots: { default: "<button>Retry</button>" },
      global: global_,
    });
    expect(wrapper.find(".tr-async-state__actions").exists()).toBe(true);
  });
});

describe("ListAsyncState", () => {
  it("priority: loading beats error/empty/no-results", () => {
    const wrapper = mount(ListAsyncState, {
      props: { loading: true, error: true, empty: true, noResults: true },
      global: global_,
    });
    expect(wrapper.find(".tr-async-state--loading").exists()).toBe(true);
  });

  it("priority: error beats empty/no-results", () => {
    const wrapper = mount(ListAsyncState, {
      props: { error: true, empty: true, noResults: true, errorMessage: "boom" },
      global: global_,
    });
    expect(wrapper.find(".tr-async-state--error").exists()).toBe(true);
    expect(wrapper.text()).toContain("boom");
  });

  it("empty with no title/message renders the empty-action slot directly", () => {
    const wrapper = mount(ListAsyncState, {
      props: { empty: true },
      slots: { "empty-action": "<button>Create</button>" },
      global: global_,
    });
    expect(wrapper.find(".tr-async-state").exists()).toBe(false);
    expect(wrapper.text()).toContain("Create");
  });

  it("renders the default slot once no flag is set", () => {
    const wrapper = mount(ListAsyncState, {
      slots: { default: '<p class="content">Loaded</p>' },
      global: global_,
    });
    expect(wrapper.find(".content").text()).toBe("Loaded");
  });
});
