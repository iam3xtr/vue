<template>
  <span
    class="tr-channel-type"
    :class="[
      `tr-channel-type--${isKnown ? normalized : 'unknown'}`,
      `tr-channel-type--${size}`,
      `tr-channel-type--${variant}`,
      { 'tr-channel-type--with-text': isKnown ? false : visibleText !== '' },
    ]"
    :role="namedImage ? 'img' : undefined"
    :aria-label="namedImage ? label : undefined"
    :aria-hidden="decorative ? 'true' : undefined"
    :title="namedImage ? label : undefined"
  >
    <Icon :name="symbol" :size="pxSize" aria-hidden="true" />
    <span v-if="!isKnown && visibleText !== ''" class="tr-channel-type__text">{{ visibleText }}</span>
  </span>
</template>

<script setup>
import { computed } from "vue";

import Icon from "./Icon.vue";
import { CHANNEL_TYPES, CHANNEL_TYPE_SYMBOLS, normalizeChannelType } from "../channel-type.js";

/**
 * Decorative-or-named channel transport symbol (not an avatar, not a status).
 * One mapping, `type -> symbol`, for the canonical visual kinds `web`,
 * `widget`, `telegram`, `email`, `whatsapp`, `max` (see `channel-type.js`).
 * `web` and `widget` are origins of one public Web publication, never a
 * `Channel.provider`. Anything else (missing, future, hostile) renders a
 * neutral chat symbol plus the consumer `label` (or the raw value) as
 * escaped text — never another provider's mark.
 *
 * The package ships no language defaults: `label` is consumer-localized.
 * - `label` + default: icon-only, `role="img"` with `aria-label`/`title`.
 * - `decorative` (use when readable text of the same type is adjacent):
 *   `aria-hidden`, no name. Without `label` the known icon is decorative.
 * Not focusable and performs no network access.
 *
 * Props: `type`, `size` (`compact` 16px | `header` 20px), `variant`
 * (`mono` follows currentColor | `brand` tints recognizable marks),
 * `label`, `decorative`.
 */
const props = defineProps({
  type: { type: [String, Number], default: null },
  size: { type: String, default: "compact", validator: (v) => ["compact", "header"].includes(v) },
  variant: { type: String, default: "mono", validator: (v) => ["mono", "brand"].includes(v) },
  label: { type: String, default: "" },
  decorative: { type: Boolean, default: false },
});

const normalized = computed(() => normalizeChannelType(props.type));
const isKnown = computed(() => CHANNEL_TYPES.includes(normalized.value));
const symbol = computed(() =>
  isKnown.value ? CHANNEL_TYPE_SYMBOLS[normalized.value] : CHANNEL_TYPE_SYMBOLS.unknown,
);
const pxSize = computed(() => (props.size === "header" ? 20 : 16));
// Unknown types always show text so the fallback is honest and readable.
const visibleText = computed(() => props.label || (props.type == null ? "" : String(props.type)));
const namedImage = computed(() => isKnown.value && !props.decorative && props.label !== "");
</script>
