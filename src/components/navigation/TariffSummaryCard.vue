<template>
  <component :is="linkComponent" v-bind="linkProps" class="tr-card tr-card--interactive tr-sidebar-tariff">
    <div class="tr-sidebar-tariff__heading">
      <span class="tr-sidebar-tariff__label">{{ label }}</span>

      <strong
        class="tr-sidebar-tariff__name"
        :class="{ 'tr-sidebar-tariff__name--accent': tariff.tagType }"
      >
        {{ tariff.displayName }}
      </strong>
    </div>

    <div class="tr-stack tr-sidebar-tariff__limits">
      <div v-for="limit in tariff.limits" :key="limit.key">
        <span class="tr-sidebar-tariff__limit-label">{{ limit.label }}</span>
        <b-progress
          v-if="limit.progress !== null"
          :value="limit.progress"
          type="is-primary"
          size="is-small"
        />
        <span class="tr-muted tr-sidebar-tariff__caption">{{ limit.caption }}</span>
      </div>
    </div>
  </component>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

/**
 * @typedef {Object} TariffSummaryLimit
 * @property {string} key
 * @property {string} label
 * @property {number|null} progress - 0-100, or `null` to hide the bar (e.g. an unlimited plan)
 * @property {string} caption
 */
/**
 * @typedef {Object} TariffSummary
 * @property {string} displayName
 * @property {boolean} [tagType] - true renders `displayName` with the accent modifier (e.g. a paid/highlighted plan)
 * @property {TariffSummaryLimit[]} limits
 */

/**
 * Presentation-only sidebar card summarizing the current workspace's
 * tariff/plan: name, accent flag, and a list of usage limits with optional
 * progress bars. Lives in this package's `./navigation` entry point because
 * it renders as a `RouterLink` when a `to` target is given — but unlike the
 * kit component this is ported from, it does not hardcode the consuming
 * application's own plans route: the caller supplies `to`, or omits it to
 * render a plain, non-interactive `<div>`.
 *
 * Props: `tariff` (required, `TariffSummary`), `label` (heading text above
 * the plan name, default `"Тариф"` — override for a non-Russian consumer),
 * `to` (`RouteLocationRaw`, default `null` — when set, the card renders as
 * a `RouterLink` to it; the consuming app owns what that route is).
 * Slots: none.
 *
 * Requires Buefy (`b-progress`) and, only when `to` is passed, Vue Router.
 */
const props = defineProps({
  /** @type {import("vue").PropType<TariffSummary>} */
  tariff: {
    type: Object,
    required: true,
  },
  label: {
    type: String,
    default: "Тариф",
  },
  /** @type {import("vue").PropType<import("vue-router").RouteLocationRaw | null>} */
  to: {
    type: [String, Object],
    default: null,
  },
});

const linkComponent = computed(() => (props.to ? RouterLink : "div"));
const linkProps = computed(() => (props.to ? { to: props.to } : {}));
</script>
