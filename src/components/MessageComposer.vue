<template>
  <form
    class="tr-message-composer"
    :aria-label="ariaLabel || undefined"
    @submit.prevent="onFormSubmit"
  >
    <textarea
      ref="textareaRef"
      class="tr-message-composer__textarea"
      :class="{ 'tr-message-composer__textarea--disabled': disabled }"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="textareaAriaLabel || undefined"
      :aria-disabled="disabled ? 'true' : undefined"
      :aria-busy="busy ? 'true' : undefined"
      :rows="1"
      :disabled="disabled"
      @input="onInput"
      @keydown="onKeydown"
      @compositionstart="isComposing = true"
      @compositionend="isComposing = false"
    />
    <button
      type="submit"
      class="tr-message-composer__submit"
      :class="{ 'tr-message-composer__submit--disabled': submitDisabled }"
      :disabled="submitDisabled"
      :aria-label="submitAriaLabel || undefined"
      :title="submitAriaLabel || undefined"
    >
      <slot name="submit-icon">
        <!--
          Default icon. The package ships no user-facing copy; consumers
          needing a different glyph or label render it through the
          `submit-icon` slot.
        -->
        <span aria-hidden="true">&#10148;</span>
      </slot>
    </button>
  </form>
</template>

<script setup>
/**
 * Public message composer.
 *
 * The composer owns the controlled draft surface and the keyboard /
 * pointer submit semantics. It does **not** send anything: every submit
 * fires `submit` with the trimmed, non-empty draft and lets the consumer
 * decide whether the message was actually delivered. The draft is never
 * cleared by this component — the consumer resets `v-model` itself after
 * a successful send (or keeps it on failure, so the user does not lose
 * typed text).
 *
 * Props:
 *
 * - `modelValue` (String, required for the controlled contract) — the
 *   current draft text. Bound via `v-model`. Updated through
 *   `update:modelValue` on every input event.
 * - `disabled` (Boolean) — when true, the textarea and submit button are
 *   inert and no `submit` event ever fires. Default: `false`.
 * - `busy` (Boolean) — surfaces `aria-busy="true"` on the textarea and
 *   blocks the same submit paths as `disabled`. The consumer owns the
 *   actual in-flight state; this flag is purely a render-time gate so the
 *   user can see the composer is busy and the keyboard/click paths
 *   cannot fire `submit` while a previous send is still pending. Default:
 *   `false`.
 * - `placeholder`, `ariaLabel`, `textareaAriaLabel`, `submitAriaLabel`
 *   (String) — consumer-owned copy. The component ships no in-built
 *   user-facing strings; pass translated strings from the consuming app.
 *
 * Events:
 *
 * - `update:modelValue` — fired on every textarea input. The payload is
 *   the raw input value; no trimming happens here.
 * - `submit` — fired exactly when a valid submit intent succeeds:
 *   non-empty trimmed draft, no IME composition, not `disabled`, not
 *   `busy`, and the activation came from either the submit button, a
 *   `keydown` whose `key === "Enter"` without `shiftKey`, or the form's
 *   native submit. The payload is the trimmed draft string.
 *
 * Slots:
 *
 * - `submit-icon` (no scope) — replaces the default submit glyph.
 *
 * Keyboard and IME contract:
 *
 * - `Enter` without `Shift` triggers a submit when the activation
 *   conditions above are met; the newline insertion in the textarea is
 *   suppressed (`preventDefault`) so a desktop Enter does not accumulate
 *   stray newlines alongside an actual send.
 * - `Shift+Enter` inserts a newline; `submit` does not fire.
 * - IME composition (`compositionstart` → `compositionend`) is ignored
 *   while active so an in-progress CJK or other IME composition never
 *   fires `submit`, even if the user hits Enter to confirm the IME
 *   candidate.
 * - Mobile and desktop both expose a visible submit button so Enter is
 *   not the only path — the mobile keyboard's Enter often changes layout
 *   instead of submitting, and the explicit button stays available with
 *   the same `submit` contract.
 *
 * The component imports no Pinia store, no router, no fixtures, no
 * secrets, no i18n runtime and no browser global. It renders no Buefy
 * components itself; consumers may style the textarea/button through
 * the `tr-message-composer*` selectors in `@iam3xtr/ui`.
 *
 * Existing `.tr-conversation-composer*`, `.tr-conversation-messages` and
 * `.tr-chat-message` selectors and their layout are intentionally not
 * reused: the new `.tr-message-composer*` selectors are scoped
 * independently, so downstream consumers that still depend on the old
 * class names keep their rendering.
 */

import { computed, ref } from "vue";

const props = defineProps({
    modelValue: {
        type: String,
        default: "",
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    busy: {
        type: Boolean,
        default: false,
    },
    placeholder: {
        type: String,
        default: "",
    },
    ariaLabel: {
        type: String,
        default: null,
    },
    textareaAriaLabel: {
        type: String,
        default: null,
    },
    submitAriaLabel: {
        type: String,
        default: null,
    },
});

const emit = defineEmits(["update:modelValue", "submit"]);

const textareaRef = ref(/** @type {HTMLTextAreaElement|null} */ (null));
const isComposing = ref(false);

const trimmed = computed(() => (props.modelValue ?? "").trim());

const canSubmit = computed(
    () => !props.disabled && !props.busy && !isComposing.value && trimmed.value.length > 0,
);

const submitDisabled = computed(() => !canSubmit.value);

function onInput(event) {
    emit("update:modelValue", event.target.value);
}

function emitSubmit() {
    if (!canSubmit.value) return;
    emit("submit", trimmed.value);
}

function onKeydown(event) {
    if (event.key !== "Enter") return;
    if (event.isComposing) return;
    if (event.shiftKey) return;
    // Suppress the browser's native newline insertion: with our contract
    // a single Enter is a submit, not a newline, on both desktop and
    // mobile. Shift+Enter above already handles the explicit newline.
    event.preventDefault();
    emitSubmit();
}

function onFormSubmit() {
    // The submit button is type="submit" and the wrapper is a real
    // <form>; pressing Enter inside the textarea already triggers this
    // path through the browser's implicit form submission. We re-check
    // the same guards here so the contract is identical for every
    // activation source.
    emitSubmit();
}

defineExpose({
    focus: () => textareaRef.value?.focus?.(),
});
</script>