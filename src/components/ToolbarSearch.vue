<template>
  <div
    class="tr-search-field"
    :data-search-priority="priority"
  >
    <b-input
      ref="searchInput"
      v-model="model"
      icon="magnify"
      :placeholder="placeholder"
      :aria-label="ariaLabel ?? placeholder"
    />
    <kbd class="tr-search-field__shortcut">{{ shortcutLabel }}</kbd>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

/** @typedef {"navbar" | "page"} SearchPriority */

/**
 * A `b-input` search field with a visible `Ctrl K`/`⌘ K` shortcut hint that
 * also actually focuses the field on that keypress.
 *
 * Props: `placeholder` (required), `ariaLabel` (defaults to `placeholder`),
 * `priority` (`"navbar" | "page"`, default `"page"`) — when two instances
 * are mounted at once (e.g. a page-level search and a global navbar
 * search), a `"navbar"`-priority instance yields the shortcut to any
 * currently-mounted `"page"`-priority instance instead of also handling it.
 * `v-model` (required): the search query.
 * Emits: `shortcut` — fired when this instance wins the keyboard shortcut,
 * right before it focuses its own input (a caller with a `filters` mobile
 * panel etc. can use this to make sure the field is visible first).
 *
 * Requires Buefy (`b-input`). SSR-safe: `navigator.platform` and the
 * `keydown` listener are only touched inside `onMounted`, and the listener
 * is removed in `onBeforeUnmount`.
 */
const props = defineProps({
  placeholder: {
    type: String,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: undefined,
  },
  /** @type {import("vue").PropType<SearchPriority>} */
  priority: {
    type: String,
    default: "page",
  },
});

const emit = defineEmits(["shortcut"]);

const model = defineModel({ required: true });
const searchInput = ref(null);
const shortcutLabel = ref("Ctrl K");

function handleSearchShortcut(event) {
  if (
    !(event.ctrlKey || event.metaKey)
    || event.key.toLocaleLowerCase() !== "k"
  ) {
    return;
  }

  if (
    props.priority === "navbar"
    && document.querySelector('[data-search-priority="page"]')
  ) {
    return;
  }

  event.preventDefault();
  emit("shortcut");
  void nextTick(() => searchInput.value?.focus());
}

onMounted(() => {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
    shortcutLabel.value = "⌘ K";
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleSearchShortcut);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleSearchShortcut);
  }
});
</script>
