import { createNotice } from "./ui/notice.js";
import {
  scopedArchives,
  resolveChannel,
  listChannels,
  archiveFilename,
} from "./archive/selection.js";
import {
  validateArchive,
  mergeArchives,
  channelKey,
  archiveKey,
} from "./archive/model.js";
import {
  openArchiveDatabase,
  readArchives,
  saveArchives,
} from "./archive/storage.js";
import { $, esc } from "./ui/dom.js";
import { createFormatting } from "./ui/formatting.js";
import { createRenderer } from "./ui/renderer.js";
let archives = [],
  activeChannel = null,
  selected = null,
  view = "messages",
  thread = null,
  limit = 150,
  db = null,
  data = mergeArchives([]),
  demo = false;
const formatting = createFormatting(() => data);
const { name } = formatting;
const { render, renderThread } = createRenderer(
  () => ({ archives, activeChannel, selected, view, thread, limit, data }),
  formatting,
);
const notice = createNotice($("notice"), $("noticeText"), $("closeNotice"));
function chosen() {
  return scopedArchives(archives, activeChannel, selected);
}
function switchChannel(key) {
  activeChannel = key;
  selected = null;
  thread = null;
  limit = 150;
  for (const id of ["search", "person", "from", "to"]) $(id).value = "";
  rebuild();
}
function rebuild() {
  activeChannel = resolveChannel(archives, activeChannel);
  data = mergeArchives(chosen());
  const prev = $("person").value;
  const authors = new Map(
    data.messages.map((m) => [
      m.user_id || m.bot_id || m.author_name || "",
      name(m),
    ]),
  );
  $("person").innerHTML =
    '<option value="">All people</option>' +
    [...authors]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`)
      .join("");
  $("person").value = prev;
  render();
}
function reset() {
  for (const id of ["search", "person", "from", "to"]) $(id).value = "";
  selected = null;
  limit = 150;
  rebuild();
}
function modal(title, content) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = content;
  $("modal").showModal();
}
function download(a) {
  const b = new Blob([JSON.stringify(a, null, 2)], {
      type: "application/json",
    }),
    u = URL.createObjectURL(b),
    el = document.createElement("a");
  el.href = u;
  el.download = archiveFilename(a);
  el.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function persist() {
  if (demo || !db) return Promise.resolve();
  return saveArchives(db, archives);
}
async function ingest(files) {
  let good = 0,
    errors = [];
  for (const f of files) {
    try {
      if (f.size > 50 * 1024 * 1024) throw Error("File exceeds 50 MB.");
      const a = validateArchive(JSON.parse(await f.text()));
      if (demo) {
        archives = [];
        demo = false;
      }
      const old = archives.find((x) => archiveKey(x) === archiveKey(a));
      if (old && Date.parse(old.exported_at) > Date.parse(a.exported_at)) {
        errors.push(f.name + ": skipped older snapshot");
        continue;
      }
      archives = archives.filter((x) => archiveKey(x) !== archiveKey(a));
      archives.push(a);
      activeChannel = channelKey(a);
      good++;
    } catch (e) {
      errors.push(f.name + ": " + e.message);
    }
  }
  if (good)
    for (const id of ["search", "person", "from", "to"]) $(id).value = "";
  archives.sort((a, b) => b.range.start_date.localeCompare(a.range.start_date));
  selected = null;
  thread = null;
  view = "messages";
  limit = 150;
  rebuild();
  try {
    await persist();
  } catch (e) {
    errors.push(
      "Browser storage failed. This import is available for this session only. Keep the original files.",
    );
  }
  notice(
    (good ? `Imported ${good} archive${good === 1 ? "" : "s"}. ` : "") +
      errors.join("\n"),
  );
  $("fileInput").value = "";
}
async function loadDemo() {
  try {
    const a = validateArchive(
      await fetch("/archive/sample-conversation.json").then((response) => {
        if (!response.ok) throw Error("Could not load sample archive.");
        return response.json();
      }),
    );
    archives = [a];
    demo = true;
    selected = null;
    rebuild();
    notice(
      "Sample conversation · fictional content · not saved to this browser",
    );
  } catch (e) {
    notice(e.message);
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (
    b.hasAttribute("data-import") ||
    ["importTop", "importSide"].includes(b.id)
  )
    $("fileInput").click();
  if (b.dataset.view) {
    view = b.dataset.view;
    limit = 150;
    render();
  }
  if (b.dataset.thread) {
    thread = b.dataset.thread;
    renderThread();
  }
  if (b.dataset.meta) {
    const m = data.messages.find((x) => x.ts === b.dataset.meta);
    modal(
      "Message metadata",
      "<pre>" + esc(JSON.stringify(m, null, 2)) + "</pre>",
    );
  }
  if (b.dataset.archiveMeta) {
    const a = archives.find((x) => archiveKey(x) === b.dataset.archiveMeta);
    modal(
      "Original archive metadata",
      "<pre>" + esc(JSON.stringify(a, null, 2)) + "</pre>",
    );
  }
  if (b.dataset.channel) {
    switchChannel(b.dataset.channel);
  }
  if (b.dataset.archive) {
    selected = selected === b.dataset.archive ? null : b.dataset.archive;
    const archive = archives.find((a) => archiveKey(a) === selected);
    if (archive) activeChannel = channelKey(archive);
    thread = null;
    rebuild();
  }
  if (
    b.dataset.remove &&
    confirm(
      "Remove this archive from this browser? Your original JSON file is unaffected.",
    )
  ) {
    archives = archives.filter((a) => archiveKey(a) !== b.dataset.remove);
    selected = null;
    thread = null;
    rebuild();
    try {
      await persist();
      notice("Archive removed from this browser.");
    } catch {
      notice("Could not update browser storage; removal will not persist.");
    }
  }
  if (b.dataset.export)
    download(archives.find((a) => archiveKey(a) === b.dataset.export));
  if (b.id === "demoButton") loadDemo();
  if (["closeModal"].includes(b.id)) $("modal").close();
  if (b.id === "closeThread") {
    thread = null;
    renderThread();
  }
  if (["home", "allNav"].includes(b.id)) {
    view = "messages";
    selected = null;
    rebuild();
  }
  if (b.id === "threadsNav") {
    view = "threads";
    render();
  }
  if (b.id === "filesNav") {
    view = "files";
    render();
  }
  if (b.id === "more") {
    limit += 150;
    const scroll = $("content").scrollTop;
    render();
    $("content").scrollTop = scroll;
  }
  if (["reset", "clearEmpty"].includes(b.id)) reset();
  if (b.id === "help")
    modal(
      "A consistent home for your archives",
      '<p>Import version 1.0.0 JSON archives from your weekly export. Load multiple files together; overlapping messages are merged automatically.</p><p>Click a reply count to read the thread, or ⋯ to inspect original message metadata. Use About to inspect completeness reports and download original snapshots.</p><p><a href="/archive/archive-format.md" download="archive-format.md">Format specification</a> · <a href="/archive/archive-template.json" download="archive-template.json">Template</a> · <a href="/archive/archive.schema.json" download="archive.schema.json">JSON Schema</a></p>',
    );
});
$("workspaceSelect").addEventListener("change", (e) =>
  switchChannel(channelKey(listChannels(archives, e.target.value)[0])),
);
$("channelSelect").addEventListener("change", (e) =>
  switchChannel(e.target.value),
);
$("fileInput").addEventListener("change", (e) => ingest([...e.target.files]));
for (const id of ["search", "person", "from", "to"])
  $(id).addEventListener("input", () => {
    limit = 150;
    render();
  });
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    $("search").focus();
  }
  if (e.key === "Escape") {
    thread = null;
    renderThread();
  }
});
let drag = 0;
document.addEventListener("dragenter", (e) => {
  if (e.dataTransfer.types.includes("Files")) {
    e.preventDefault();
    drag++;
    $("dropOverlay").hidden = false;
  }
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("dragleave", () => {
  if (--drag <= 0) {
    drag = 0;
    $("dropOverlay").hidden = true;
  }
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  drag = 0;
  $("dropOverlay").hidden = true;
  ingest([...e.dataTransfer.files]);
});
render();
try {
  db = await openArchiveDatabase();
  archives = (await readArchives(db)).map(validateArchive);
  rebuild();
} catch {
  notice(
    "Persistent browser storage is unavailable. Imports work for this session; keep your original files.",
  );
  $("storageStatus").textContent = "Session only · keep your JSON files";
}
