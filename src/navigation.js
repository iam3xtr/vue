// Navigation entry point (`@iam3xtr/vue/navigation`): the components in the
// core entry point (`.`) never require a mounted Vue Router; these three
// do — each renders a `RouterLink` unconditionally on import (not only
// when used), so importing this module requires Vue Router to be
// installed. It is a separate entry precisely so an application (or an SSR
// context) that only needs the router-free core surface is never forced to
// resolve Vue Router just to import `Icon`/`Loader`/etc.
//
// None of these hardcode a consuming application's own route: `PageHeader`
// takes a `back.to` location from its caller, `NavbarTabs` takes `items`
// with their own `to`, and `TariffSummaryCard` takes an optional `to` — the
// consuming application owns what those routes actually are.
export { default as PageHeader } from "./components/navigation/PageHeader.vue";
export { default as NavbarTabs } from "./components/navigation/NavbarTabs.vue";
export { default as TariffSummaryCard } from "./components/navigation/TariffSummaryCard.vue";
