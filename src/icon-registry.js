// Injection contract for `Icon.vue`'s custom-SVG registry. This package
// ships no icon files of its own — the approved custom-icon set (LLM vendor
// logos, model-kind icons; everything else in a Buefy app is a plain
// `b-icon` MDI name) lives in `@iam3xtr/ui`'s `assets/icons/*`. The
// consuming application resolves those files with whatever asset pipeline
// it already has (`vite-svg-loader`, a raw-string import, a static URL —
// this package does not care) and registers the resulting map once, at the
// application root, via `provideIconRegistry`. Nothing is registered as a
// side effect of importing this module or `Icon.vue`.
export const iconRegistryKey = Symbol("trIconRegistry");

/**
 * @param {import("vue").App} app
 * @param {Record<string, unknown>} registry `{ [iconName]: Component | string }`
 *   — a resolved Vue component (SVG-as-component loaders) or an SVG markup
 *   string (for `v-html`-style rendering) per registered custom icon name.
 */
export function provideIconRegistry(app, registry) {
  app.provide(iconRegistryKey, registry);
}
