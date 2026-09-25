<template>
  <section
    class="tr-chat-history"
    :aria-label="ariaLabel || undefined"
    :aria-live="ariaLive || undefined"
  >
    <div
      v-if="hasMessages"
      class="tr-chat-history__list"
    >
      <article
        v-for="message in messages"
        :key="messageKey(message)"
        class="tr-chat-history__message"
        :class="{ 'tr-chat-history__message--outgoing': isOutgoing(message) }"
      >
        <div class="tr-chat-history__body">
          <!--
            Default body: plain `text`, escaped exactly as written. The
            package never injects user-facing copy or formatting; consumers
            who need markdown, mentions or attachments use the `body` slot
            below. With no slot given the message is a single `<p>` of the
            `text` field — whitespace preserved via `pre-wrap`.
          -->
          <slot name="body" :message="message">
            <p class="tr-chat-history__text">{{ message.text }}</p>
          </slot>
        </div>

        <div
          v-if="$slots.metadata || $slots.status"
          class="tr-chat-history__meta"
        >
          <slot name="metadata" :message="message" />
          <slot name="status" :message="message" />
        </div>
      </article>
    </div>

    <div
      v-else
      class="tr-chat-history__empty"
    >
      <!--
        Empty state is a fully consumer-owned slot. With no slot given we
        render nothing — the package never ships built-in user-facing
        strings, per `ui.3xtr.im#15`.
      -->
      <slot name="empty" />
    </div>
  </section>
</template>

<script setup>
/**
 * Public message history.
 *
 * Renders an ordered, app-agnostic list of chat messages. The package owns
 * only the structural markup and the `tr-chat-history*` visual contract
 * (`@iam3xtr/ui`); messages, statuses, retries, delivery badges and any
 * translation come from the consumer.
 *
 * Props:
 *
 * - `messages` (required) — ordered array of messages. Each entry must
 *   expose a stable `id` (string/number, used as the keyed `:key`),
 *   `text` (the default body) and an `outgoing` boolean (or equivalent
 *   truthy value) when the consumer wants the message anchored to the
 *   end of the conversation. The component never mutates this array and
 *   never reads any field other than `id`, `text` and `outgoing`; metadata
 *   (timestamps, sender, status) is rendered only through slots.
 * - `ariaLabel` (optional) — accessible name for the `<section>` wrapper.
 *   `aria-live` defaults to `"polite"` so new outgoing/incoming messages
 *   are announced without interrupting the user; pass `aria-live="off"` or
 *   `"assertive"` to override.
 *
 * Slots:
 *
 * - `body` (scoped: `{ message }`) — replaces the default plain-text
 *   paragraph. Use it for markdown, mentions, attachments or any rich
 *   rendering; the package does not interpret the slot's contents.
 * - `metadata` (scoped: `{ message }`) — appears under each message's
 *   body. Typical consumers put a timestamp or sender name here.
 * - `status` (scoped: `{ message }`) — appears next to `metadata` (same
 *   row). Typical consumers put delivery / read / retry UI here.
 * - `empty` (no scope) — replaces the otherwise-empty state. With no
 *   `empty` slot the empty state renders nothing, so the package ships
 *   no built-in user-facing text.
 *
 * The component imports no Pinia store, no router, no fixtures, no
 * secrets, no i18n runtime and no browser global. It renders no Buefy
 * components itself; consumer slots may freely use them.
 *
 * Existing `.tr-conversation-messages` / `.tr-chat-message` selectors and
 * their layout are intentionally not reused here: the new
 * `.tr-chat-history*` selectors are scoped independently, so downstream
 * consumers that still depend on the old class names keep their rendering.
 */

import { computed } from "vue";

const props = defineProps({
  /** @type {import("vue").PropType<Array<{id:string|number,text:string,outgoing?:boolean}>>} */
  messages: {
    type: Array,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: null,
  },
  ariaLive: {
    type: String,
    default: "polite",
  },
});

const hasMessages = computed(() => Array.isArray(props.messages) && props.messages.length > 0);

function isOutgoing(message) {
  return !!(message && message.outgoing);
}

function messageKey(message) {
  return message?.id;
}
</script>