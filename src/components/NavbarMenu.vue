<template>
  <Teleport v-if="target && active" :to="target">
    <slot />
  </Teleport>
</template>

<script setup>
import { inject, onActivated, onDeactivated, ref } from "vue";

import { navbarMenuKey } from "../composables/navbarMenu.js";

/**
 * Teleport wrapper that projects a page's own menu content (typically a
 * `NavbarTabs` from the `./navigation` entry point, but any markup works)
 * into a target provided by the application shell via `navbarMenuKey`. The
 * page keeps its own handlers, permissions and reactive state — only the
 * DOM output moves.
 *
 * Slot: default — the content to teleport.
 *
 * Until the shell provides a target (`app.provide(navbarMenuKey, targetRef)`
 * — a `Ref<Element | string | null>`, the same value `<Teleport :to>`
 * accepts), or after this instance unmounts, nothing renders. While kept
 * alive by a parent `<KeepAlive>` and deactivated, the menu is hidden
 * rather than left stale in the target; it reappears on reactivation.
 * Several `NavbarMenu` instances mounted at once simply append to the same
 * target — only one page branch is expected to own it at a time.
 *
 * No Buefy or router dependency; SSR-safe (renders nothing without an
 * injected target, which a server render never provides unless the shell
 * explicitly does).
 */
const target = inject(navbarMenuKey, null);
const active = ref(true);

onActivated(() => {
  active.value = true;
});

onDeactivated(() => {
  active.value = false;
});
</script>
