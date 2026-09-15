<template>
  <div class="copy-pre">
    <button
      type="button"
      class="button is-small copy-pre__button"
      :class="{ 'is-success': copied }"
      :disabled="!canCopy"
      :title="buttonTitle"
      :aria-label="buttonTitle"
      @click="copyToClipboard"
    >
      <b-icon icon="content-copy" size="is-small" />
      <span class="is-sr-only">{{ buttonText }}</span>
    </button>
    <pre class="copy-pre__pre"><slot>{{ text }}</slot></pre>
    <!-- The slot is the contract: a caller can render formatted content
         (e.g. with syntax highlighting) while `text` remains what actually
         goes to the clipboard. With no slot given, `text` is also what's
         displayed. -->
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";

/**
 * A height-limited `<pre>` with a floating copy-to-clipboard button in the
 * top-right corner. Height, padding and typography come from the `.copy-pre*`
 * foundation classes in `@iam3xtr/ui`'s theme; there is no separate style
 * contract here.
 *
 * Props: `text` (String/Number, the value copied — and, with no default
 * slot content, also displayed), `buttonLabel`/`copiedLabel` (accessible
 * name and visible sr-only text before/after a successful copy — override
 * for a non-Russian consumer), `title` (tooltip; falls back to
 * `buttonLabel`), `disabled`.
 * Slot: default — optional formatted content to display instead of raw
 * `text`.
 *
 * Requires Buefy (`b-icon`). SSR-safe: `navigator.clipboard` is read only
 * inside the `click` handler, never at setup/render time; the copy-success
 * timer is cleared in `onBeforeUnmount`.
 */
const props = defineProps({
  text: {
    type: [String, Number],
    default: "",
  },
  buttonLabel: {
    type: String,
    default: "Копировать",
  },
  copiedLabel: {
    type: String,
    default: "Скопировано!",
  },
  title: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const copied = ref(false);
let copiedTimer = null;

const canCopy = computed(
  () => !props.disabled && String(props.text ?? "").length > 0,
);
const buttonText = computed(() =>
  copied.value ? props.copiedLabel : props.buttonLabel,
);
const buttonTitle = computed(() =>
  copied.value ? props.copiedLabel : props.title || props.buttonLabel,
);

async function copyToClipboard() {
  if (!canCopy.value) return;

  try {
    await navigator.clipboard.writeText(String(props.text));
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied.value = false;
      copiedTimer = null;
    }, 2000);
  } catch (error) {
    console.error("Clipboard copy failed", error);
  }
}

onBeforeUnmount(() => {
  clearTimeout(copiedTimer);
});
</script>
