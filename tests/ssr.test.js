// @vitest-environment node
//
// Runs under Vitest's plain `node` environment (no jsdom `window`/`document`
// globals at all) to verify the core entry point's SSR contract: importing
// it, and server-rendering its non-Buefy-only-at-render components, never
// touches a browser global. Buefy's own SSR compatibility is out of scope
// for this package's contract — only this package's code is asserted here.
import { describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";

describe("core entry point on the server", () => {
  it("imports without window/document defined", async () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    const mod = await import("../src/index.js");
    expect(mod.Icon).toBeTruthy();
    expect(mod.Loader).toBeTruthy();
    expect(mod.AsyncState).toBeTruthy();
    expect(mod.ListAsyncState).toBeTruthy();
    expect(mod.CopyPre).toBeTruthy();
    expect(mod.Toolbar).toBeTruthy();
    expect(mod.NavbarMenu).toBeTruthy();
    expect(mod.FileDropTarget).toBeTruthy();
    expect(mod.FormDrawer).toBeTruthy();
  });

  it("server-renders Loader without touching window/document", async () => {
    const { Loader } = await import("../src/index.js");
    const app = createSSRApp(Loader, { label: "Loading" });
    const html = await renderToString(app);
    expect(html).toContain("tr-loader");
    expect(html).toContain('role="status"');
  });

  it("server-renders Icon resolved from the @iam3xtr/ui default registry", async () => {
    const { Icon } = await import("../src/index.js");
    const app = createSSRApp(Icon, { name: "anthropic" });
    const html = await renderToString(app);
    expect(html).toContain("tr-icon");
    expect(html).toContain("<svg");
  });

  it("server-renders Icon (unregistered name, no Buefy) as the placeholder", async () => {
    const { Icon } = await import("../src/index.js");
    const app = createSSRApp(Icon, { name: "totally-unregistered-name" });
    const html = await renderToString(app);
    expect(html).toContain("tr-icon--placeholder");
  });

  it("server-renders AsyncState/ListAsyncState/CopyPre/NavbarMenu without throwing", async () => {
    const { AsyncState, ListAsyncState, CopyPre, NavbarMenu } = await import("../src/index.js");

    await expect(renderToString(createSSRApp(AsyncState, { variant: "empty", title: "None" }))).resolves.toContain(
      "tr-async-state",
    );
    await expect(
      renderToString(createSSRApp(AsyncState, { variant: "loading", title: "Loading agents" })),
    ).resolves.toContain('aria-label="Loading agents"');
    await expect(renderToString(createSSRApp(ListAsyncState, {}))).resolves.toBeDefined();
    await expect(renderToString(createSSRApp(CopyPre, { text: "x" }))).resolves.toContain("copy-pre");
    // No injected target on the server (the shell never provides one during
    // an initial SSR pass) — renders nothing, does not throw.
    await expect(renderToString(createSSRApp(NavbarMenu))).resolves.toBe("<!---->");
  });

  it("Toolbar with no search/filters props renders without needing Buefy", async () => {
    const { Toolbar } = await import("../src/index.js");
    const html = await renderToString(createSSRApp(Toolbar));
    expect(html).toContain("tr-page-toolbar");
  });

  it("server-renders FileDropTarget without a drag in progress, no overlay markup", async () => {
    const { FileDropTarget } = await import("../src/index.js");
    const html = await renderToString(createSSRApp(FileDropTarget));
    expect(html).toContain("tr-file-drop-target");
    expect(html).not.toContain("tr-file-drop-target__overlay");
  });

  // FormDrawer's root element is `b-sidebar` itself (unlike the components
  // above, which only reach for Buefy on an inner node under a plain
  // wrapper), so — same as MobileFilters/ToolbarSearch/ToolbarDropdown, not
  // covered here either — a meaningful render assertion needs Buefy
  // registered, which is exactly the Buefy-SSR-compat scope this file's own
  // contract (see header comment) leaves out. Its component test file
  // covers behavior with Buefy mounted instead.
});
