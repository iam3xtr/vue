import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import FileDropTarget from "../src/components/FileDropTarget.vue";

function fileTransfer(files) {
  return { types: ["Files"], files, dropEffect: "none" };
}

function textTransfer() {
  return { types: ["text/plain"], files: [] };
}

function makeFile(name, type = "text/plain") {
  return new File(["x"], name, { type });
}

describe("FileDropTarget", () => {
  it("does not show the overlay before any drag", () => {
    const wrapper = mount(FileDropTarget, { slots: { default: "<button>Row</button>" } });
    expect(wrapper.find(".tr-file-drop-target__overlay").exists()).toBe(false);
  });

  it("shows the overlay while a file drag is over the target and hides it on drop", async () => {
    const wrapper = mount(FileDropTarget);
    const dt = fileTransfer([makeFile("a.txt")]);
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    expect(wrapper.find(".tr-file-drop-target__overlay").exists()).toBe(true);

    await wrapper.trigger("drop", { dataTransfer: dt });
    expect(wrapper.find(".tr-file-drop-target__overlay").exists()).toBe(false);
  });

  it("emits a single files event with the dropped File[] on drop", async () => {
    const wrapper = mount(FileDropTarget);
    const file = makeFile("report.pdf", "application/pdf");
    const dt = fileTransfer([file]);
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    await wrapper.trigger("drop", { dataTransfer: dt });

    expect(wrapper.emitted("files")).toHaveLength(1);
    expect(wrapper.emitted("files")[0][0]).toEqual([file]);
  });

  it("ignores a drag that carries no files", async () => {
    const wrapper = mount(FileDropTarget);
    const dt = textTransfer();
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    expect(wrapper.find(".tr-file-drop-target__overlay").exists()).toBe(false);

    await wrapper.trigger("drop", { dataTransfer: dt });
    expect(wrapper.emitted("files")).toBeUndefined();
  });

  it("keeps only the first file when multiple is false", async () => {
    const wrapper = mount(FileDropTarget, { props: { multiple: false } });
    const files = [makeFile("a.txt"), makeFile("b.txt")];
    const dt = fileTransfer(files);
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    await wrapper.trigger("drop", { dataTransfer: dt });

    expect(wrapper.emitted("files")[0][0]).toEqual([files[0]]);
  });

  it("filters dropped files against the accept pattern", async () => {
    const wrapper = mount(FileDropTarget, { props: { accept: ".pdf,image/*" } });
    const files = [makeFile("a.txt"), makeFile("b.pdf"), makeFile("c.png", "image/png")];
    const dt = fileTransfer(files);
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    await wrapper.trigger("drop", { dataTransfer: dt });

    expect(wrapper.emitted("files")[0][0]).toEqual([files[1], files[2]]);
  });

  it("does not emit when accept filters out every dropped file", async () => {
    const wrapper = mount(FileDropTarget, { props: { accept: ".pdf" } });
    const dt = fileTransfer([makeFile("a.txt")]);
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    await wrapper.trigger("drop", { dataTransfer: dt });

    expect(wrapper.emitted("files")).toBeUndefined();
  });

  it("never shows the overlay or emits files while disabled", async () => {
    const wrapper = mount(FileDropTarget, { props: { disabled: true } });
    const dt = fileTransfer([makeFile("a.txt")]);
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    expect(wrapper.find(".tr-file-drop-target__overlay").exists()).toBe(false);

    await wrapper.trigger("drop", { dataTransfer: dt });
    expect(wrapper.emitted("files")).toBeUndefined();
  });

  it("holds the overlay across a dragenter/dragleave pair on a nested child (drag depth)", async () => {
    const wrapper = mount(FileDropTarget, {
      slots: { default: '<div class="child"><span class="grandchild">Row</span></div>' },
    });
    const dt = fileTransfer([makeFile("a.txt")]);

    // Entering the outer target, then a nested child: depth goes 0 -> 1 -> 2.
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    await wrapper.find(".child").trigger("dragenter", { dataTransfer: dt });
    expect(wrapper.find(".tr-file-drop-target__overlay").exists()).toBe(true);

    // Leaving the nested child back to the outer target: depth goes 2 -> 1,
    // still > 0, so the overlay must not flicker off.
    await wrapper.find(".child").trigger("dragleave", { dataTransfer: dt });
    expect(wrapper.find(".tr-file-drop-target__overlay").exists()).toBe(true);

    // Leaving the outer target entirely: depth goes 1 -> 0, overlay hides.
    await wrapper.trigger("dragleave", { dataTransfer: dt });
    expect(wrapper.find(".tr-file-drop-target__overlay").exists()).toBe(false);
  });

  it("keeps normal click interaction on slot content untouched (no picker to open)", async () => {
    let clicked = 0;
    const wrapper = mount(FileDropTarget, {
      slots: { default: '<button class="row-action">Sort</button>' },
    });
    wrapper.find(".row-action").element.addEventListener("click", () => {
      clicked += 1;
    });
    await wrapper.find(".row-action").trigger("click");
    expect(clicked).toBe(1);
    // No hidden <input type="file"> exists to have been opened.
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
  });

  it("gives the overlay an accessible live-status role", async () => {
    const wrapper = mount(FileDropTarget);
    const dt = fileTransfer([makeFile("a.txt")]);
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    const overlay = wrapper.find(".tr-file-drop-target__overlay");
    expect(overlay.attributes("role")).toBe("status");
    expect(overlay.attributes("aria-live")).toBe("polite");
    expect(overlay.text()).toBe("Отпустите файлы, чтобы загрузить");
  });

  it("accepts a custom overlay label", async () => {
    const wrapper = mount(FileDropTarget, { props: { overlayLabel: "Drop files to upload" } });
    const dt = fileTransfer([makeFile("a.txt")]);
    await wrapper.trigger("dragenter", { dataTransfer: dt });
    expect(wrapper.find(".tr-file-drop-target__overlay").text()).toBe("Drop files to upload");
  });
});
