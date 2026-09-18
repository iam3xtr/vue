// Core entry point (`@iam3xtr/vue`): portable Vue components and
// framework-level composables that need neither a mounted Vue Router shell
// nor `window`/`document` at import time (browser-only work happens inside
// lifecycle hooks with matching cleanup — see each component's own doc
// comment). Router-dependent components (`PageHeader`, `NavbarTabs`,
// `TariffSummaryCard`) live in the separate `./navigation` entry point
// instead, so importing this module never requires an installed Vue Router.
//
// Buefy is a required peer dependency for most of these (see each
// component's doc comment for which Buefy components it renders) and must
// be installed/registered by the consuming application exactly once — this
// package does not call `app.use(Buefy)` itself. `@iam3xtr/ui` is a
// required peer for `Loader` (inlines its SVG marks) and is the recommended
// source for `Icon`'s custom-icon registry (see `icon-registry.js`).
export { default as Icon } from "./components/Icon.vue";
export { default as Loader } from "./components/Loader.vue";
export { default as AsyncState } from "./components/AsyncState.vue";
export { default as ListAsyncState } from "./components/ListAsyncState.vue";
export { default as CopyPre } from "./components/CopyPre.vue";
export { default as Toolbar } from "./components/Toolbar.vue";
export { default as ToolbarDropdown } from "./components/ToolbarDropdown.vue";
export { default as ToolbarSearch } from "./components/ToolbarSearch.vue";
export { default as MobileFilters } from "./components/MobileFilters.vue";
export { default as NavbarMenu } from "./components/NavbarMenu.vue";
export { default as FileDropTarget } from "./components/FileDropTarget.vue";
export { default as FormDrawer } from "./components/FormDrawer.vue";

export { iconRegistryKey, provideIconRegistry } from "./icon-registry.js";
export { navbarMenuKey } from "./composables/navbarMenu.js";
export { useFocusTrap } from "./composables/useFocusTrap.js";
