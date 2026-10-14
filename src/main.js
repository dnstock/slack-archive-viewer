import {
  loadHostedArchives,
  isHosted,
  sourceKey,
  enabledArchives,
  browserArchives,
  readDisabledArchives,
  saveDisabledArchives,
} from "./archive/hosted.js";
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
const disabled = readDisabledArchives();
let completeStartup;
const ready = new Promise((resolve) => {
  completeStartup = resolve;
});
const formatting = createFormatting(() => data);
const { name } = formatting;
const { render, renderThread } = createRenderer(
  () => ({
    archives,
    disabled,
    activeChannel,
    selected,
    view,
    thread,
    limit,
    data,
  }),
  formatting,
);
const notice = createNotice($("notice"), $("noticeText"), $("closeNotice"));
function chosen() {
  return scopedArchives(
    enabledArchives(archives, disabled),
    activeChannel,
    selected,
  );
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
  activeChannel = resolveChannel(
    enabledArchives(archives, disabled),
    activeChannel,
  );
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
  return saveArchives(db, browserArchives(archives));
}
async function ingest(files) {
  await ready;
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
      const old = browserArchives(archives).find(
        (x) => archiveKey(x) === archiveKey(a),
      );
      if (old && Date.parse(old.exported_at) > Date.parse(a.exported_at)) {
        errors.push(f.name + ": skipped older snapshot");
        continue;
      }
      archives = archives.filter(
        (x) => isHosted(x) || archiveKey(x) !== archiveKey(a),
      );
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
  await ready;
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
    const a = archives.find((x) => sourceKey(x) === b.dataset.archiveMeta);
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
    const archive = archives.find((a) => sourceKey(a) === selected);
    if (archive) activeChannel = channelKey(archive);
    thread = null;
    rebuild();
  }
  if (
    b.dataset.remove &&
    archives.some((a) => sourceKey(a) === b.dataset.remove && !isHosted(a)) &&
    confirm(
      "Remove this archive from this browser? Your original JSON file is unaffected.",
    )
  ) {
    archives = archives.filter(
      (a) => isHosted(a) || sourceKey(a) !== b.dataset.remove,
    );
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
    download(archives.find((a) => sourceKey(a) === b.dataset.export));
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
    render({ prepend: true });
  }
  if (["reset", "clearEmpty"].includes(b.id)) reset();
  if (b.id === "manageArchives")
    modal("Manage archives", $("archives").innerHTML);
  if (b.id === "help")
    modal(
      "A consistent home for your archives",
      '<p>Import version 1.0.0 JSON archives from your weekly export. Load multiple files together; overlapping messages are merged automatically.</p><p>Click a reply count to read the thread, or ⋯ to inspect original message metadata. Use About to inspect completeness reports and download original snapshots.</p><p><a href="/archive/archive-format.md" download="archive-format.md">Format specification</a> · <a href="/archive/archive-template.json" download="archive-template.json">Template</a> · <a href="/archive/archive.schema.json" download="archive.schema.json">JSON Schema</a></p>',
    );
});
$("workspaceSelect").addEventListener("change", (e) =>
  switchChannel(
    channelKey(
      listChannels(enabledArchives(archives, disabled), e.target.value)[0],
    ),
  ),
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
document.addEventListener("change", (e) => {
  const id = e.target.dataset?.toggleHosted;
  if (!id) return;
  if (e.target.checked) disabled.delete(id);
  else disabled.add(id);
  if (selected === id) selected = null;
  thread = null;
  limit = 150;
  rebuild();
  try {
    saveDisabledArchives(disabled);
  } catch {
    notice(
      "Archive preference could not be saved; this choice applies for this session.",
    );
  }
});
render();
// Discover hosted files and browser imports independently: one unavailable source
// must not prevent the other from loading.
const startup = await Promise.allSettled([
  loadHostedArchives(),
  (async () => {
    db = await openArchiveDatabase();
    return (await readArchives(db)).map(validateArchive);
  })(),
]);
const errors = [];
if (startup[0].status === "fulfilled") {
  archives.push(...startup[0].value.archives);
  errors.push(...startup[0].value.errors);
} else errors.push(startup[0].reason.message);
if (startup[1].status === "fulfilled") archives.push(...startup[1].value);
else {
  errors.push(
    "Persistent browser storage is unavailable. Imports work for this session; keep your original files.",
  );
  $("storageStatus").textContent =
    "Session imports · shared archives from server";
}
archives.sort((a, b) => b.range.start_date.localeCompare(a.range.start_date));
rebuild();
if (errors.length) notice(errors.join("\n"));

completeStartup();
