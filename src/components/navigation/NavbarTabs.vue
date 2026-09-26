<template>
  <nav
    ref="rootRef"
    class="tr-navbar-tabs"
    :class="{ 'is-overflowing': isOverflowing }"
    :aria-label="ariaLabel"
  >
    <button
      v-if="isOverflowing"
      class="tr-navbar-tabs__arrow tr-navbar-tabs__arrow--prev"
      type="button"
      :aria-label="prevLabel"
      :title="prevLabel"
      :disabled="!canScrollPrev"
      @click="scrollStep(-1)"
    >
      <svg class="tr-navbar-tabs__arrow-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path :d="prevIconPath" />
      </svg>
    </button>

    <div
      ref="viewportRef"
      class="tr-navbar-tabs__viewport"
      @scroll.passive="updateScrollState"
    >
      <div ref="trackRef" class="tr-navbar-tabs__track">
        <RouterLink
          v-for="item in items"
          :key="item.label"
          :to="item.to"
          class="tr-navbar-tabs__link"
        >
          {{ item.label }}
        </RouterLink>
      </div>
    </div>

    <button
      v-if="isOverflowing"
      class="tr-navbar-tabs__arrow tr-navbar-tabs__arrow--next"
      type="button"
      :aria-label="nextLabel"
      :title="nextLabel"
      :disabled="!canScrollNext"
      @click="scrollStep(1)"
    >
      <svg class="tr-navbar-tabs__arrow-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path :d="nextIconPath" />
      </svg>
    </button>
  </nav>
</template>

<script setup>
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref, watch,
} from "vue";
import { RouterLink, useRoute } from "vue-router";

/**
 * @typedef {Object} NavbarTabItem
 * @property {string} label
 * @property {import("vue-router").RouteLocationRaw} to
 */

/**
 * A row of route-link tabs, typically teleported into the app shell's
 * navbar via `NavbarMenu` (core entry point). Lives in this package's
 * `./navigation` entry point (not core) because it always imports and
 * renders `RouterLink`, requiring an installed and mounted Vue Router.
 *
 * The strip takes whatever width its container gives it (in the navbar:
 * the free space between the brand and the right-hand actions) and never
 * shrinks tabs into clipped text. It measures its real overflow — not a
 * viewport breakpoint — and only then renders previous/next arrow buttons
 * that scroll to the next hidden tab; without overflow no arrows render and
 * no space is reserved for them. The active (`aria-current="page"`) tab is
 * scrolled into view after a route change and after a resize.
 *
 * Props: `items` (required — array of `{ label, to }`), `ariaLabel`
 * (default `"Навигационные вкладки"`), `prevLabel` (default
 * `"Предыдущие вкладки"`) and `nextLabel` (default `"Следующие вкладки"`)
 * — accessible names of the arrow buttons; override all three for a
 * non-Russian consumer.
 * Slots: none.
 *
 * Requires Vue Router.
 */
const props = defineProps({
  /** @type {import("vue").PropType<NavbarTabItem[]>} */
  items: {
    type: Array,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: "Навигационные вкладки",
  },
  prevLabel: {
    type: String,
    default: "Предыдущие вкладки",
  },
  nextLabel: {
    type: String,
    default: "Следующие вкладки",
  },
});

// MDI chevron-left / chevron-right path data, inlined so the component keeps
// its Router-only dependency (no Buefy/MDI font required).
const CHEVRON_LEFT = "M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z";
const CHEVRON_RIGHT = "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z";

// Sub-pixel tolerance for layout comparisons (fractional widths/zoom).
const EPSILON = 1;

const route = useRoute();

const rootRef = ref(null);
const viewportRef = ref(null);
const trackRef = ref(null);
const isOverflowing = ref(false);
const canScrollPrev = ref(false);
const canScrollNext = ref(false);
const isRtl = ref(false);

const prevIconPath = computed(() => (isRtl.value ? CHEVRON_RIGHT : CHEVRON_LEFT));
const nextIconPath = computed(() => (isRtl.value ? CHEVRON_LEFT : CHEVRON_RIGHT));

let resizeObserver = null;
let lastViewportWidth = -1;

function getLinks() {
  const track = trackRef.value;
  return track ? Array.from(track.querySelectorAll(".tr-navbar-tabs__link")) : [];
}

function updateScrollState() {
  const viewport = viewportRef.value;
  if (!viewport) return;
  const maxScroll = viewport.scrollWidth - viewport.clientWidth;
  // In RTL `scrollLeft` runs from 0 towards negative values; its magnitude
  // is the distance from the inline start in both directions.
  const offset = Math.abs(viewport.scrollLeft);
  canScrollPrev.value = maxScroll > EPSILON && offset > EPSILON;
  canScrollNext.value = maxScroll > EPSILON && offset < maxScroll - EPSILON;
}

function measure() {
  const viewport = viewportRef.value;
  if (!viewport) return;
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    isRtl.value = window.getComputedStyle(viewport).direction === "rtl";
  }
  let available = viewport.clientWidth;
  if (isOverflowing.value && rootRef.value) {
    // The arrows themselves narrow the viewport; count the space they and
    // their gaps occupy so the strip drops them as soon as every tab would
    // fit without them.
    const arrows = rootRef.value.querySelectorAll(".tr-navbar-tabs__arrow");
    const gap = parseFloat(window.getComputedStyle(rootRef.value).columnGap) || 0;
    arrows.forEach((arrow) => {
      available += arrow.offsetWidth + gap;
    });
  }
  isOverflowing.value = viewport.scrollWidth - available > EPSILON;
  updateScrollState();
}

/**
 * Scrolls the viewport by a physical horizontal delta. `scrollBy` is
 * physical in both writing directions, so callers pass screen-space deltas.
 */
function scrollViewportBy(left) {
  const viewport = viewportRef.value;
  if (!viewport || Math.abs(left) <= EPSILON) return;
  if (typeof viewport.scrollBy === "function") {
    viewport.scrollBy({ left });
  } else {
    viewport.scrollLeft += left;
  }
}

/**
 * Brings `link` fully into the viewport with the smallest scroll.
 */
function reveal(link) {
  const viewport = viewportRef.value;
  if (!viewport || !link) return;
  const box = viewport.getBoundingClientRect();
  const rect = link.getBoundingClientRect();
  if (rect.left < box.left - EPSILON) {
    scrollViewportBy(rect.left - box.left);
  } else if (rect.right > box.right + EPSILON) {
    scrollViewportBy(rect.right - box.right);
  }
}

function revealActive() {
  const track = trackRef.value;
  if (!track || !isOverflowing.value) return;
  const active = track.querySelector('[aria-current="page"]')
    ?? track.querySelector(".router-link-active");
  reveal(active);
}

/**
 * Scrolls to the next hidden tab in the logical direction: `1` — towards the
 * inline end, `-1` — towards the inline start.
 */
function scrollStep(direction) {
  const viewport = viewportRef.value;
  if (!viewport) return;
  const box = viewport.getBoundingClientRect();
  // Physical side the arrow scrolls towards.
  const towardsRight = (direction > 0) !== isRtl.value;
  const links = getLinks();
  if (towardsRight) {
    const hidden = links.find((link) => link.getBoundingClientRect().right > box.right + EPSILON);
    if (hidden) scrollViewportBy(hidden.getBoundingClientRect().right - box.right);
  } else {
    const hidden = [...links].reverse()
      .find((link) => link.getBoundingClientRect().left < box.left - EPSILON);
    if (hidden) scrollViewportBy(hidden.getBoundingClientRect().left - box.left);
  }
}

function handleResize() {
  const wasOverflowing = isOverflowing.value;
  measure();
  const width = viewportRef.value?.clientWidth ?? -1;
  // Keep the active tab visible when the available width changes or the
  // strip starts overflowing; a pure scroll does not re-snap to it.
  if (isOverflowing.value !== wasOverflowing) {
    // Arrows were just added or removed and change the viewport width:
    // settle the scroll state and active tab against the rendered strip.
    nextTick(() => {
      lastViewportWidth = viewportRef.value?.clientWidth ?? -1;
      updateScrollState();
      revealActive();
    });
  } else if (width !== lastViewportWidth) {
    lastViewportWidth = width;
    revealActive();
  }
}

async function remeasureAndReveal() {
  await nextTick();
  measure();
  revealActive();
}

watch(() => route?.fullPath, remeasureAndReveal);
watch(() => props.items, remeasureAndReveal, { deep: true });

onMounted(() => {
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(viewportRef.value);
    resizeObserver.observe(trackRef.value);
  } else if (typeof window !== "undefined") {
    window.addEventListener("resize", handleResize);
  }
  handleResize();
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  } else if (typeof window !== "undefined") {
    window.removeEventListener("resize", handleResize);
  }
});
</script>
