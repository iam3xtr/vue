// Plugin entry point (`@iam3xtr/vue/plugin`): one documented way to
// register every public core and navigation component from this package as
// a global, under a fixed `tr-*` name, in a single `app.use(trVue)` call.
// The named imports from `.` (core) and `./navigation` remain the
// bundle-sensitive alternative and are completely unaffected by this
// module — neither of those two entry points imports this file, so
// consumers who only ever use named imports never resolve this module or
// its Vue Router dependency.
//
// This module itself imports `./components/navigation/*`, so — unlike `.`
// — it always needs an installed Vue Router, exactly like `./navigation`.
// The consumer's setup order is Router -> Buefy -> trVue: this plugin never
// calls `app.use()`/`createRouter()` itself, never registers Buefy, and
// never imports `@iam3xtr/ui`'s theme CSS — those remain the consuming
// application's own responsibility, done once, before `app.use(trVue)`.
import Icon from "./components/Icon.vue";
import Loader from "./components/Loader.vue";
import AsyncState from "./components/AsyncState.vue";
import ListAsyncState from "./components/ListAsyncState.vue";
import CopyPre from "./components/CopyPre.vue";
import Toolbar from "./components/Toolbar.vue";
import ToolbarDropdown from "./components/ToolbarDropdown.vue";
import ToolbarSearch from "./components/ToolbarSearch.vue";
import MobileFilters from "./components/MobileFilters.vue";
import NavbarMenu from "./components/NavbarMenu.vue";
import FileDropTarget from "./components/FileDropTarget.vue";
import FormDrawer from "./components/FormDrawer.vue";
import PageHeader from "./components/navigation/PageHeader.vue";
import NavbarTabs from "./components/navigation/NavbarTabs.vue";
import TariffSummaryCard from "./components/navigation/TariffSummaryCard.vue";

// Fixed table of global names `trVue` registers — kept in sync with the
// table documented in README.md ("Плагин `trVue`"). A global `Icon` name
// registers the component itself, not any icon *data* — the injected
// custom-icon registry (`provideIconRegistry`) is still opt-in and
// unrelated to installing this plugin; a global icon *registry* default is
// out of scope here (tracked separately, after issue #8).
export const trVueComponents = {
  "tr-icon": Icon,
  "tr-loader": Loader,
  "tr-async-state": AsyncState,
  "tr-list-async-state": ListAsyncState,
  "tr-copy-pre": CopyPre,
  "tr-toolbar": Toolbar,
  "tr-toolbar-dropdown": ToolbarDropdown,
  "tr-toolbar-search": ToolbarSearch,
  "tr-mobile-filters": MobileFilters,
  "tr-navbar-menu": NavbarMenu,
  "tr-file-drop-target": FileDropTarget,
  "tr-form-drawer": FormDrawer,
  "tr-page-header": PageHeader,
  "tr-navbar-tabs": NavbarTabs,
  "tr-tariff-summary-card": TariffSummaryCard,
};

// Per-app install guard (not module-level): a module-level boolean would
// wrongly report "already installed" for a second, independent `app`
// (e.g. two apps in the same test run/process), and would not protect a
// second `createApp()` in the same module graph. Stashing the flag on the
// `app` instance itself scopes it correctly and needs no extra import.
const INSTALLED_FLAG = "__trVueInstalled";

/**
 * `@iam3xtr/vue/plugin`'s `trVue`: `app.use(trVue)` registers every public
 * core and navigation component from this package as a global component
 * under the fixed `tr-*` name listed in `trVueComponents` above (and in
 * README.md). Installing it twice on the same `app` (accidental double
 * `app.use(trVue)`, or a shared setup helper called more than once) is a
 * no-op on the second call — no duplicate `app.component()` registration,
 * so no "already has been registered" Vue warning.
 */
export const trVue = {
  install(app) {
    if (app[INSTALLED_FLAG]) return;
    app[INSTALLED_FLAG] = true;
    for (const [name, component] of Object.entries(trVueComponents)) {
      app.component(name, component);
    }
  },
};
