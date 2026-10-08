<template>
  <b-sidebar
    class="tr-form-drawer"
    :model-value="modelValue"
    type="is-light"
    right
    overlay
    fullheight
    :can-cancel="false"
    :style="width ? { '--tr-form-drawer-width': width } : undefined"
  >
    <component
      :is="shell ? 'div' : 'form'"
      ref="formEl"
      class="tr-form-drawer__form"
      tabindex="-1"
      @submit.prevent="handleSubmit"
    >
      <header class="tr-form-drawer__header">
        <h2 v-if="title" class="tr-form-drawer__title">{{ title }}</h2>
        <button
          type="button"
          class="tr-form-drawer__close"
          :aria-label="closeAriaLabel"
          @click="requestClose('close-button')"
        >
          <b-icon icon="close" />
        </button>
      </header>

      <div v-if="shell" class="tr-form-drawer__shell">
        <slot
          name="shell"
          :content="ShellContent"
          :busy="busy"
          :disabled="disabled"
          :request-close="requestClose"
        />
      </div>

      <template v-else>
        <div class="tr-form-drawer__body">
          <slot :busy="busy" :disabled="disabled" :request-close="requestClose" />
        </div>

        <footer v-if="$slots.footer" class="tr-form-drawer__footer">
          <slot name="footer" :busy="busy" :disabled="disabled" :request-close="requestClose" />
        </footer>
      </template>
    </component>
  </b-sidebar>
</template>

<script setup>
import { computed, h, onBeforeUnmount, onMounted, ref, useSlots, watch } from "vue";

import { useFocusTrap } from "../composables/useFocusTrap.js";

/**
 * Shared right-hand form drawer built on Buefy's own `b-sidebar` (`right`,
 * `overlay`, `fullheight`) instead of a bespoke overlay implementation, so
 * that consumers get one documented header/body/footer/submit contract
 * instead of hand-assembling the same three regions and native `<form>`
 * semantics on every screen that needs an edit-in-a-drawer flow.
 *
 * Props: `modelValue` (Boolean, required — `v-model`, forwarded to
 * `b-sidebar`'s `model-value`; programmatic control by the parent is never
 * guarded), `beforeClose` (Function, optional — async close guard, see
 * "Close guard" below), `title` (String,
 * optional — rendered in the header; omit for a drawer whose form body
 * supplies its own heading), `busy` (Boolean — suppresses `submit` emission
 * while a save is in flight; does not by itself disable body/footer
 * controls, see below), `disabled` (Boolean — also suppresses `submit`
 * emission, e.g. for a permission-denied form), `closeAriaLabel` (String,
 * default `"Закрыть"` — accessible name of the header close button;
 * override for a non-Russian consumer).
 *
 * Events: `update:modelValue` (Boolean — always `false`; emitted only after
 * a user-initiated close (Escape, backdrop click, header close button or
 * `requestClose()`) has passed the close guard), `submit` (the native `SubmitEvent`
 * — emitted at most once per user-initiated submit and never while `busy`
 * or `disabled`, so a slow first click cannot fire a second request; the
 * component does not call `preventDefault`-adjacent validation, does not
 * read `FormData`, and does not know about drafts, dirty state or any API —
 * the consumer's own submit handler owns all of that).
 *
 * Slots: default — the form body region, scrolled independently of the
 * header/footer; `footer` — action buttons, rendered as a non-scrolling
 * region that stays visible under a long body. Both slots receive `busy`
 * and `disabled` as scoped-slot props purely as a convenience so a footer
 * submit button can bind `:loading="busy"`/`:disabled="disabled || busy"`
 * without the consumer re-deriving them; the component still applies its
 * own guard on `submit` regardless of whether the consumer wires those up.
 *
 * Close guard: every user-initiated way to close the drawer (Escape, a click
 * on the backdrop, the header close button and the exposed `requestClose()`)
 * goes through one path. `beforeClose(reason)` receives the reason
 * (`"escape" | "backdrop" | "close-button" | "programmatic"`) and may return
 * a boolean or a Promise of one. Only `false` or a rejection/throw denies:
 * the drawer stays open (the sidebar is never hidden intermediately) and the
 * form draft is untouched. While a guard is pending, further close requests
 * join it instead of starting another one. An allowed request emits
 * `update:modelValue(false)` exactly once. A result that arrives after the
 * parent changed `modelValue` itself, after the drawer was reopened or after
 * unmount is discarded. To achieve this the component passes
 * `:can-cancel="false"` to `b-sidebar` (Buefy hides the sidebar before it
 * emits, and does not await `onCancel`) and handles Escape/backdrop itself.
 * Without `beforeClose`, requests close immediately. `busy`/`disabled` do
 * not block closing; a consumer that must forbid closing (e.g. during an
 * upload) returns `false` from `beforeClose`. `requestClose(reason?)` is
 * available through a template ref and resolves to whether the drawer closed.
 *
 * Focus management: built in, no consumer wiring. When the drawer actually
 * opens (including when it is mounted already open) focus moves to the first
 * focusable control inside it; Tab/Shift+Tab cycle within the drawer (and a
 * drawer without focusable controls holds focus on its own container instead
 * of letting it escape); when it actually closes focus returns to the element
 * that had it before opening, unless that element is gone from the DOM.
 * "Actually" means driven by `modelValue`, so a close request denied or still
 * pending in `beforeClose` never moves focus. Escape is handled once, by the
 * close guard above, never by the focus trap. `b-sidebar` itself provides no
 * focus trap or focus return, which is why this is layered on its content
 * (via `useFocusTrap`) rather than on any Buefy-internal DOM.
 *
 * Shell mode: `shell` (Boolean, default `false`) is for a consumer-owned
 * form such as vee-validate's `<Form>`. The drawer then renders no `<form>`
 * of its own, so the consumer's form is the only one. It cannot wrap the
 * drawer from outside because `b-sidebar` moves its element to
 * `document.body`; instead the `shell` slot is rendered inside the drawer,
 * under the header, and receives `{ content, busy, disabled, requestClose }`.
 * `content` is a component that renders the regular default-slot body and
 * `footer` slot region (same classes, scroll and footer behaviour as the
 * native mode), so the consumer only places it inside its form:
 * `<template #shell="{ content }"><Form @submit="save"><component
 * :is="content" /></Form></template>` (a slot variable cannot be used as a
 * `<Tag>` in a template, hence `<component :is>`). The consumer's form must be
 * a direct child of the `shell` slot root (it becomes a direct child of
 * `.tr-form-drawer__shell`); the theme's flex layout and the body scroll/fixed
 * footer depend on it, so do not wrap it in another element. `shell` without a
 * `shell` slot renders an empty body (a dev-only console warning is logged).
 * The default and `footer`
 * slots are still how the
 * body and actions are supplied (they stay in the consumer's template scope,
 * but are rendered under the consumer's form, so vee-validate fields inject
 * its context); a footer `type="submit"` button submits that form and its
 * validation decides whether anything is sent. In shell mode `submit` is
 * never emitted and `busy`/`disabled` remain scoped-slot values the consumer
 * applies to its own handler. The header close button and `requestClose`
 * (also a scoped-slot prop of the default, `footer` and `shell` slots, so a
 * footer cancel button can call `requestClose("programmatic")`) use the
 * close guard. Native mode is unchanged. The package does not depend on
 * vee-validate; all copy and accessible names come from the consumer.
 *
 * Width: `width` (String, optional — must be a valid CSS length such as `"42rem"`; it is
 * not validated, an invalid value is ignored by the browser) sets
 * the panel width through the `--tr-form-drawer-width` custom property that
 * the `@iam3xtr/ui` theme consumes; no consumer CSS override is needed.
 * Without it the default is `420px`. The theme always clamps the panel to the
 * viewport (`100vw`), so on a narrow screen it is full width regardless of
 * the requested value. Header and footer stay fixed; only the body scrolls.
 *
 * Requires Buefy (`b-sidebar`, `b-icon`).
 */
const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    default: null,
  },
  busy: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  beforeClose: {
    type: Function,
    default: null,
  },
  shell: {
    type: Boolean,
    default: false,
  },
  width: {
    type: String,
    default: null,
  },
  closeAriaLabel: {
    type: String,
    default: "Закрыть",
  },
});

const emit = defineEmits(["update:modelValue", "submit"]);

const slots = useSlots();

onMounted(() => {
  if (import.meta.env?.DEV && props.shell && !slots.shell) {
    // eslint-disable-next-line no-console
    console.warn(
      'FormDrawer: "shell" is true but no "shell" slot was provided — the drawer body will be empty.',
    );
  }
});

// Renders the default-slot body and `footer` region for shell mode, so the
// consumer's own form can wrap them without duplicating drawer markup.
function ShellContent() {
  const scope = {
    busy: props.busy,
    disabled: props.disabled,
    requestClose,
  };
  return [
    h("div", { class: "tr-form-drawer__body" }, slots.default?.(scope)),
    slots.footer ? h("footer", { class: "tr-form-drawer__footer" }, slots.footer(scope)) : null,
  ];
}

const formEl = ref(null);
useFocusTrap(
  formEl,
  computed(() => props.modelValue),
  { immediate: true, contain: true },
);

let generation = 0;
let pending = null;
let unmounted = false;

function invalidate() {
  generation += 1;
  pending = null;
}

// Any change of the open state (parent-driven close, reopen) makes a
// still-running guard stale.
watch(() => props.modelValue, invalidate, { flush: "sync" });

function requestClose(reason = "programmatic") {
  if (!props.modelValue || unmounted) return Promise.resolve(false);
  if (pending) return pending;

  const token = generation;
  const run = (async () => {
    let allowed = true;
    try {
      if (props.beforeClose) allowed = (await props.beforeClose(reason)) !== false;
    } catch {
      allowed = false;
    }
    if (token !== generation || unmounted || !props.modelValue) return false;
    pending = null;
    if (!allowed) return false;
    emit("update:modelValue", false);
    return true;
  })();
  pending = run;
  return run;
}

function isInsideOtherOverlay(target) {
  return typeof target?.closest === "function" && !!target.closest(".modal");
}

function onKeyup(event) {
  if (!props.modelValue || (event.key !== "Escape" && event.key !== "Esc")) return;
  if (isInsideOtherOverlay(event.target)) return;
  requestClose("escape");
}

function onDocumentClick(event) {
  if (!props.modelValue) return;
  const path = event.composedPath?.() ?? [];
  if (path.some((node) => node?.classList?.contains("sidebar-background"))) {
    requestClose("backdrop");
  }
}

onMounted(() => {
  document.addEventListener("keyup", onKeyup);
  document.addEventListener("click", onDocumentClick);
});

onBeforeUnmount(() => {
  unmounted = true;
  invalidate();
  document.removeEventListener("keyup", onKeyup);
  document.removeEventListener("click", onDocumentClick);
});

defineExpose({ requestClose });

function handleSubmit(event) {
  if (props.shell || props.busy || props.disabled) return;
  emit("submit", event);
}
</script>
