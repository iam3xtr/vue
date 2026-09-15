// Injection key for the Navbar's page-menu Teleport target (see
// `../components/NavbarMenu.vue`). Provided once by the application shell
// (typically alongside the Navbar's own `menu` slot/Teleport host) via
// `app.provide(navbarMenuKey, targetRef)` — belongs to that single app
// instance, never to a global store, so multiple app roots (tests, multiple
// entrypoints) never share a target by accident.
export const navbarMenuKey = Symbol("navbarMenu");
