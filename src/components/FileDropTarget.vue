<template>
  <div
    class="tr-file-drop-target"
    :class="{ 'tr-file-drop-target--dragging': isDragging }"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <slot />

    <div
      v-if="isDragging"
      class="tr-file-drop-target__overlay"
      role="status"
      aria-live="polite"
    >
      <span class="tr-file-drop-target__message">{{ overlayLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

/**
 * Portable drop surface layered over arbitrary interactive slot content
 * (e.g. a `b-table`) without turning it into a `<label>`/native picker and
 * without owning upload transport, progress, retry, cancel or any API —
 * `accept`/`multiple` are the same client-side hints a native
 * `<input type="file">` gives, not a security boundary; the consuming
 * application still validates size/type/count itself. Emits exactly one
 * event, `files`, with the resulting `File[]` on a real file drop; nothing
 * is emitted for a drag that carries no files, one entirely filtered out
 * by `accept`, or a drop while `disabled`.
 *
 * The wrapper itself is a semantically neutral `div`: it never renders (or
 * requires) a hidden `<input type="file">`, so plain click, focus, sort and
 * dropdown interactions on the slot content are untouched — there is no
 * picker to open and no click handler to intercept them. The overlay is
 * mounted only while a file drag is over the target (`v-if`, not
 * `visibility`/`opacity`) and is `pointer-events: none` in `@iam3xtr/ui`'s
 * theme, so the browser keeps firing `dragenter`/`dragleave` on the real
 * slot elements underneath it rather than on the overlay layer — that is
 * what keeps a drag that crosses nested child nodes (e.g. table rows) from
 * flickering the overlay in and out. Depth is tracked with a plain counter
 * (`dragenter` increments, `dragleave` decrements, `drop`/leaving the
 * target resets it to 0) rather than relying on any single element's
 * enter/leave pair, since those bubble from whichever nested node the
 * pointer is currently over.
 *
 * A drag is ignored altogether — no depth counted, no overlay, `dragover`
 * not even prevented — unless `event.dataTransfer.types` includes
 * `"Files"`; a plain text/link drag never triggers this component.
 *
 * Props: `disabled` (Boolean — suppresses the overlay and drop handling
 * entirely; still prevents the browser's own default of navigating to the
 * dropped file), `multiple` (Boolean, default `true` — `false` keeps only
 * the first accepted file), `accept` (String, optional comma-separated list
 * of extensions (`.pdf`), exact MIME types (`application/pdf`) or MIME
 * wildcards (`image/*`); omit to accept every dropped file), `overlayLabel`
 * (String — the overlay's accessible/visible text, default in Russian per
 * this kit's convention; override for a non-Russian consumer).
 * Emits: `files` (`File[]`, always non-empty).
 * Slot: default — the interactive content the drop surface sits over.
 *
 * No Buefy dependency; safe to import without a mounted app (no
 * window/document access outside DOM event handlers).
 */
const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  multiple: {
    type: Boolean,
    default: true,
  },
  accept: {
    type: String,
    default: null,
  },
  overlayLabel: {
    type: String,
    default: "Отпустите файлы, чтобы загрузить",
  },
});

const emit = defineEmits(["files"]);

const dragDepth = ref(0);
const isDragging = computed(() => dragDepth.value > 0);

function carriesFiles(event) {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes("Files");
}

function matchesAccept(file, pattern) {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(".")) return file.name.toLowerCase().endsWith(trimmed.toLowerCase());
  if (trimmed.endsWith("/*")) return file.type.startsWith(trimmed.slice(0, -1));
  return file.type === trimmed;
}

function filterAccepted(files) {
  if (!props.accept) return files;
  const patterns = props.accept.split(",");
  return files.filter((file) => patterns.some((pattern) => matchesAccept(file, pattern)));
}

function onDragEnter(event) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  if (props.disabled) return;
  dragDepth.value += 1;
}

function onDragOver(event) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = props.disabled ? "none" : "copy";
}

function onDragLeave(event) {
  if (!carriesFiles(event)) return;
  if (props.disabled) return;
  dragDepth.value = Math.max(0, dragDepth.value - 1);
}

function onDrop(event) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  dragDepth.value = 0;
  if (props.disabled) return;

  const dropped = Array.from(event.dataTransfer?.files ?? []);
  const accepted = filterAccepted(dropped);
  if (!accepted.length) return;

  emit("files", props.multiple ? accepted : accepted.slice(0, 1));
}
</script>
