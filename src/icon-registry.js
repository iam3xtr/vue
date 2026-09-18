// Injection contract for `Icon.vue`'s custom-SVG registry. This package
// ships no icon files of its own — the approved custom-icon set (LLM vendor
// logos, model-kind icons; everything else in a Buefy app is a plain
// `b-icon` MDI name) lives in `@iam3xtr/ui`'s `assets/icons/*`, also
// published bundler-neutral as `@iam3xtr/ui/icons` (`name -> raw SVG markup
// string`). `Icon.vue` always has that `@iam3xtr/ui` set available as its
// base registry, with no call to `provideIconRegistry` required — this
// function is only for *adding to or overriding* that base, e.g. an
// application-specific icon or a `vite-svg-loader` component replacing one
// of the raw-markup defaults. The consuming application resolves any extra
// files with whatever asset pipeline it already has (`vite-svg-loader`, a
// raw-string import, a static URL — this package does not care) and
// registers the resulting map once, at the application root, via
// `provideIconRegistry`. Nothing is registered as a side effect of
// importing this module or `Icon.vue`.
export const iconRegistryKey = Symbol("trIconRegistry");

/**
 * @param {import("vue").App} app
 * @param {Record<string, unknown>} registry `{ [iconName]: Component | string }`
 *   — a resolved Vue component (SVG-as-component loaders) or an SVG markup
 *   string (for `v-html`-style rendering) per custom icon name to add on top
 *   of, or override in, `Icon.vue`'s `@iam3xtr/ui` base registry.
 */
export function provideIconRegistry(app, registry) {
  app.provide(iconRegistryKey, registry);
}
