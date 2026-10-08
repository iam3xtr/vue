<template>
  <b-sidebar
    class="tr-form-drawer"
    :model-value="modelValue"
    type="is-light"
    right
    overlay
    fullheight
    :can-cancel="false"
  >
    <form class="tr-form-drawer__form" @submit.prevent="handleSubmit">
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

      <div class="tr-form-drawer__body">
        <slot :busy="busy" :disabled="disabled" />
      </div>

      <footer v-if="$slots.footer" class="tr-form-drawer__footer">
        <slot name="footer" :busy="busy" :disabled="disabled" />
      </footer>
    </form>
  </b-sidebar>
</template>

<script setup>
import { onBeforeUnmount, onMounted, watch } from "vue";

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
 * Explicit Buefy limitation: `b-sidebar` implements Escape-to-close,
 * outside-click-to-close and scroll lock itself, but — unlike `b-modal` —
 * it does not implement a focus trap or focus-return-to-trigger on close.
 * This component intentionally does not layer a custom focus trap over
 * `b-sidebar` to compensate (that would be exactly the "самодельный
 * overlay" this contract avoids); a consumer that needs trapped/returned
 * focus for a specific drawer instance can compose `useFocusTrap` from this
 * same package around its own trigger/drawer refs.
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
  closeAriaLabel: {
    type: String,
    default: "Закрыть",
  },
});

const emit = defineEmits(["update:modelValue", "submit"]);

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
  if (props.busy || props.disabled) return;
  emit("submit", event);
}
</script>
