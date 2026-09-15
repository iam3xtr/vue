<template>
  <AsyncState v-if="loading" variant="loading" />

  <AsyncState
    v-else-if="error"
    variant="error"
    :icon="errorIcon"
    :title="errorTitle"
    :message="errorMessage"
  >
    <template v-if="$slots['error-action']" #default>
      <slot name="error-action" />
    </template>
  </AsyncState>

  <section v-else-if="empty" class="tr-section-empty">
    <AsyncState
      v-if="emptyTitle || emptyMessage"
      variant="empty"
      :icon="emptyIcon"
      :title="emptyTitle"
      :message="emptyMessage"
    >
      <template v-if="$slots['empty-action']" #default>
        <slot name="empty-action" />
      </template>
    </AsyncState>
    <slot v-else name="empty-action" />
  </section>

  <AsyncState
    v-else-if="noResults"
    variant="no-results"
    :icon="noResultsIcon"
    :title="noResultsTitle"
    :message="noResultsMessage"
  />

  <slot v-else />
</template>

<script setup>
/**
 * Thin routing wrapper over `AsyncState`: collapses the repeating
 * loading/error/empty/no-results `v-if` chain that would otherwise be
 * duplicated on every list/detail screen into one call. Makes no request
 * and decides nothing about permissions — the caller computes the flags and
 * text itself. Priority is fixed and not configurable: `loading` > `error`
 * > `empty` > `no-results` > default slot.
 *
 * Props (all optional, string ones default to `null`): `loading` (Boolean),
 * `error`/`errorIcon`/`errorTitle`/`errorMessage`, `empty`/`emptyIcon`/
 * `emptyTitle`/`emptyMessage`, `noResults`/`noResultsIcon`/`noResultsTitle`/
 * `noResultsMessage`.
 *
 * Slots: default (rendered content once all four flags are false),
 * `error-action`, `empty-action` (also used, alone, when `empty` is true
 * but no `emptyTitle`/`emptyMessage` was given — e.g. a bare "create the
 * first item" call to action with no separate empty-state copy).
 *
 * Requires Buefy transitively through `AsyncState` when an `*Icon` prop is
 * passed.
 */
import AsyncState from "./AsyncState.vue";

defineProps({
  loading: Boolean,
  error: Boolean,
  errorIcon: { type: String, default: null },
  errorTitle: { type: String, default: null },
  errorMessage: { type: String, default: null },
  empty: Boolean,
  emptyIcon: { type: String, default: null },
  emptyTitle: { type: String, default: null },
  emptyMessage: { type: String, default: null },
  noResults: Boolean,
  noResultsIcon: { type: String, default: null },
  noResultsTitle: { type: String, default: null },
  noResultsMessage: { type: String, default: null },
});
</script>
