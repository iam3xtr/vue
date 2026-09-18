<template>
  <span
    v-if="hasSlotContent"
    class="icon tr-icon"
    :style="pxSize !== '24px' ? { width: pxSize, height: pxSize } : ''"
  >
    <slot />
  </span>
  <component
    :is="svgComponent"
    v-else-if="svgComponent && !isMarkup"
    class="icon tr-icon"
    :style="pxSize !== '24px' ? { width: pxSize, height: pxSize } : ''"
  />
  <span
    v-else-if="isMarkup"
    class="icon tr-icon"
    :style="{ width: pxSize, height: pxSize }"
    v-html="svgComponent"
  />
  <component
    :is="buefyIconComponent"
    v-else-if="showBuefyFallback"
    :icon="effectiveKey"
    class="icon tr-icon"
    :style="pxSize !== '24px' ? { width: pxSize, height: pxSize } : ''"
  />
  <span
    v-else
    class="icon tr-icon--placeholder"
    :style="{ width: pxSize, height: pxSize }"
    aria-hidden="true"
  />
</template>

<script setup>
import { Comment, Text, computed, getCurrentInstance, inject, useSlots, watchEffect } from "vue";

import { icons as uiIconRegistry } from "@iam3xtr/ui/icons";

import { iconRegistryKey } from "../icon-registry.js";

/**
 * Independent SVG-first icon adapter: resolves a name against the custom
 * SVG registry — this package's `@iam3xtr/ui`-shipped default set plus
 * whatever the consuming application adds/overrides via
 * `provideIconRegistry` (see `../icon-registry.js`) — with an optional
 * Buefy `<b-icon>` (MDI) fallback when Buefy happens to be installed. None
 * of the three ingredients is required to import or render this component:
 * with no registry provided, no Buefy installed and no default slot, an
 * unresolved name renders the same `aria-hidden` placeholder box the kit
 * predecessor used, reserving layout space at the requested size.
 *
 * Resolution precedence (first match wins):
 * 1. Non-empty default slot — full escape hatch, any markup the caller
 *    wants (a third-party icon component, a `<b-icon>` with `pack`/`alias`,
 *    plain text). `name`/`icon` are ignored (and warned about, see below)
 *    when the slot is also given.
 * 2. `name`/`icon` against the *consumer* registry entry from
 *    `provideIconRegistry` (an override/addition — see that module).
 * 3. `name`/`icon` against the *`@iam3xtr/ui`* default registry
 *    (`@iam3xtr/ui/icons`) — always available, with no `provideIconRegistry`
 *    call required. An SVG match at step 2 or 3 always wins over step 4,
 *    even when a same-named MDI icon exists.
 * 4. `name`/`icon` as a Buefy MDI name, rendered through the *globally
 *    registered* `BIcon` component (`app.use(Buefy)`/`app.component`) —
 *    read from the current app's component registry at render time, never
 *    a static `import ... from "buefy"`. Skipped entirely (falls through to
 *    the placeholder) when Buefy is not installed in the current app; the
 *    plain `<b-icon>` element elsewhere in a Buefy app is completely
 *    unaffected by this component either way.
 * 5. `aria-hidden` placeholder box at the requested size.
 *
 * `name` (legacy) and `icon` (Buefy-compatible alias for the same input)
 * are interchangeable — pass whichever reads better at the call site.
 * `name` wins when both are given with different, non-empty values (a
 * `console.warn` fires either time there is an actual conflict: slot content
 * together with `name`/`icon`, or `name` and `icon` disagreeing).
 *
 * Wrapper keeps the same `.icon`/`.tr-icon` class and forwards `class`,
 * `style`, `title`, `role`, `aria-*` and any other non-prop attrs to
 * whichever branch renders — including the Buefy fallback, so sizing and
 * accessibility attributes behave identically regardless of which registry
 * (or Buefy) resolved the icon. Exactly one of the template's five
 * `v-if`/`v-else-if` branches ever renders, so this happens through Vue's
 * default single-root attrs fallthrough alone — no branch spreads `$attrs`
 * or repeats `class` explicitly, since either would just merge the same
 * `class` string into itself twice.
 *
 * Props: `name` (registry key, legacy), `icon` (registry key, Buefy-style
 * alias for `name`), `size` (number in px, or any CSS length string;
 * default `24`).
 * Slots: `default` — takes precedence over `name`/`icon` when non-empty.
 */
const props = defineProps({
  name: {
    type: String,
    default: null,
  },
  icon: {
    type: String,
    default: null,
  },
  size: {
    type: [Number, String],
    default: 24,
  },
});

const slots = useSlots();
const instance = getCurrentInstance();
const consumerRegistry = inject(iconRegistryKey, {});

// Non-reactive by design: `provideIconRegistry` is a one-time app-root call
// (see that module's doc comment), so re-computing this on every render
// would cost more than it buys. `@iam3xtr/ui`'s registry stays the base;
// the consumer's registry only overrides/adds entries on top of it.
const mergedRegistry = { ...uiIconRegistry, ...consumerRegistry };

function hasConflict(a, b) {
  return a != null && b != null && a !== "" && b !== "" && a !== b;
}

const effectiveKey = computed(() => props.name ?? props.icon ?? null);

function slotHasContent() {
  const nodes = slots.default?.();
  if (!nodes || nodes.length === 0) return false;
  return nodes.some((vnode) => {
    if (vnode.type === Comment) return false;
    if (vnode.type === Text) return typeof vnode.children === "string" && vnode.children.trim() !== "";
    if (typeof vnode.children === "string") return vnode.children.trim() !== "";
    return true;
  });
}

// The slot function must only ever be invoked from inside this component's
// own render (Vue warns "invoked outside of the render function" otherwise,
// and loses slot dependency tracking) — so the non-empty check, and the
// warning that depends on it, both live in this computed's getter, which
// only ever runs when the template actually reads `hasSlotContent.value`.
// Never read from a `watchEffect`/other reactive scope outside the template.
const hasSlotContent = computed(() => {
  const result = slotHasContent();
  if (result && effectiveKey.value != null) {
    // eslint-disable-next-line no-console
    console.warn(
      `Icon: default slot and "name"/"icon" ("${effectiveKey.value}") were both given — the slot takes precedence.`,
    );
  }
  return result;
});

// Diagnostic-only, unconditional (this package makes no bundler-specific
// dev/production distinction anywhere else — see `../icon-registry.js`).
// Does not touch `slots`/`hasSlotContent` — see the note above.
watchEffect(() => {
  if (hasConflict(props.name, props.icon)) {
    // eslint-disable-next-line no-console
    console.warn(
      `Icon: "name" ("${props.name}") and "icon" ("${props.icon}") were both given with different values — using "name".`,
    );
  }
});

const svgEntry = computed(() =>
  effectiveKey.value != null ? mergedRegistry[effectiveKey.value] ?? null : null,
);
const isMarkup = computed(() => typeof svgEntry.value === "string");
const svgComponent = computed(() => svgEntry.value);

const buefyIconComponent = computed(
  () => instance?.appContext?.components?.BIcon ?? instance?.appContext?.components?.["b-icon"] ?? null,
);

const showBuefyFallback = computed(
  () =>
    !hasSlotContent.value &&
    !svgEntry.value &&
    effectiveKey.value != null &&
    !!buefyIconComponent.value,
);

const pxSize = computed(() => (typeof props.size === "number" ? `${props.size}px` : props.size));
</script>
