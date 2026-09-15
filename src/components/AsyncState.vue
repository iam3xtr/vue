<template>
  <div
    class="tr-async-state"
    :class="`tr-async-state--${variant}`"
    :role="variant === 'loading' ? null : role"
    :aria-live="variant === 'loading' ? null : ariaLive"
  >
    <Loader v-if="variant === 'loading'" size="section" />

    <template v-else>
      <span v-if="icon" class="tr-async-state__icon">
        <b-icon :icon="icon" size="is-large" />
      </span>
      <strong v-if="title" class="tr-async-state__title">{{ title }}</strong>
      <span v-if="message" class="tr-async-state__message">{{ message }}</span>
      <div v-if="$slots.default" class="tr-async-state__actions">
        <slot />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";

import Loader from "./Loader.vue";

/**
 * Shared content block for the five async/empty states of the
 * `.tr-async-state` contract (`loading`, `empty`, `no-results`, `error`,
 * `permission-denied` — see `@iam3xtr/ui`'s theme for the CSS). Presentation
 * only: it makes no request and decides nothing about permissions — the
 * caller passes ready-made `icon`/`title`/`message` (or delegates the
 * variant choice to `ListAsyncState`).
 *
 * Props: `variant` (required, one of the five above), `icon` (MDI name for
 * `b-icon`, optional — not every state shows one), `title`, `message`
 * (all textual props — pass translated strings from the consuming app).
 * Slot: default — action(s) shown under the message (e.g. a retry button).
 *
 * Accessibility: `error` is the only variant that interrupts with new
 * information, so it gets `role="alert"`/`aria-live="assertive"`; the rest
 * get `role="status"`/`aria-live="polite"`. `loading` sets neither (the
 * nested `Loader` already owns `role="status"`).
 *
 * Requires Buefy (`b-icon`) when `icon` is passed.
 */
const props = defineProps({
  variant: {
    type: String,
    required: true,
    validator: (value) => [
      "loading",
      "empty",
      "no-results",
      "error",
      "permission-denied",
    ].includes(value),
  },
  icon: {
    type: String,
    default: null,
  },
  title: {
    type: String,
    default: null,
  },
  message: {
    type: String,
    default: null,
  },
});

const role = computed(() => (props.variant === "error" ? "alert" : "status"));
const ariaLive = computed(() => (props.variant === "error" ? "assertive" : "polite"));
</script>
