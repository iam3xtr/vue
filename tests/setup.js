// jsdom has no `matchMedia`; `Loader` (via `Loader.vue`) and some Buefy
// components (`b-dropdown`) read it.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom has no real clipboard API; CopyPre only touches it inside a click
// handler, but that handler still needs something to call.
if (typeof navigator !== "undefined" && !navigator.clipboard) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: async () => {} },
    configurable: true,
  });
}
