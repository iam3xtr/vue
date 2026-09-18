<template>
  <b-sidebar
    class="tr-form-drawer"
    :model-value="modelValue"
    type="is-light"
    right
    overlay
    fullheight
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form class="tr-form-drawer__form" @submit.prevent="handleSubmit">
      <header class="tr-form-drawer__header">
        <h2 v-if="title" class="tr-form-drawer__title">{{ title }}</h2>
        <button
          type="button"
          class="tr-form-drawer__close"
          :aria-label="closeAriaLabel"
          @click="handleClose"
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
/**
 * Shared right-hand form drawer built on Buefy's own `b-sidebar` (`right`,
 * `overlay`, `fullheight`) instead of a bespoke overlay implementation, so
 * that consumers get one documented header/body/footer/submit contract
 * instead of hand-assembling the same three regions and native `<form>`
 * semantics on every screen that needs an edit-in-a-drawer flow.
 *
 * Props: `modelValue` (Boolean, required — `v-model`, forwarded to
 * `b-sidebar`'s own `model-value`/`update:model-value`; setting it `false`
 * — including from the header close button — closes the drawer the same
 * way Buefy's own Escape/outside-click cancel does), `title` (String,
 * optional — rendered in the header; omit for a drawer whose form body
 * supplies its own heading), `busy` (Boolean — suppresses `submit` emission
 * while a save is in flight; does not by itself disable body/footer
 * controls, see below), `disabled` (Boolean — also suppresses `submit`
 * emission, e.g. for a permission-denied form), `closeAriaLabel` (String,
 * default `"Закрыть"` — accessible name of the header close button;
 * override for a non-Russian consumer).
 *
 * Events: `update:modelValue` (Boolean — open state, relayed from
 * `b-sidebar` on Escape/outside-click/close-button as well as emitted
 * directly by the header close button), `submit` (the native `SubmitEvent`
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
  closeAriaLabel: {
    type: String,
    default: "Закрыть",
  },
});

const emit = defineEmits(["update:modelValue", "submit"]);

function handleClose() {
  emit("update:modelValue", false);
}

function handleSubmit(event) {
  if (props.busy || props.disabled) return;
  emit("submit", event);
}
</script>
