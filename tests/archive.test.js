import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateArchive,
  mergeArchives,
  timestampCompare,
  channelKey,
  archiveKey,
} from "../src/archive/model.js";
import { createFormatting } from "../src/ui/formatting.js";
const sample = JSON.parse(
  await readFile(
    new URL("../public/archive/sample-conversation.json", import.meta.url),
  ),
);

test("sample and downloadable template satisfy the import contract", async () => {
  assert.equal(
    validateArchive(structuredClone(sample)).archive_id,
    "sample-conversation",
  );
  const template = JSON.parse(
    await readFile(
      new URL("../public/archive/archive-template.json", import.meta.url),
    ),
  );
  assert.equal(validateArchive(template), template);
});
test("invalid archives and duplicate message timestamps are rejected", () => {
  assert.throws(
    () => validateArchive({ ...sample, schema_version: "2" }),
    /schema_version/,
  );
  assert.throws(
    () =>
      validateArchive({
        ...sample,
        messages: [sample.messages[0], sample.messages[0]],
      }),
    /Duplicate/,
  );
});
test("overlapping exports use the newest snapshot without modifying the originals", () => {
  const older = structuredClone(sample);
  const newer = structuredClone(sample);
  newer.archive_id = "newer";
  newer.exported_at = "2026-10-20T12:00:00Z";
  newer.messages[0].text = "Updated";
  const result = mergeArchives([newer, older]);
  assert.equal(result.messages.length, sample.messages.length);
  assert.equal(
    result.messages.find((m) => m.ts === newer.messages[0].ts).text,
    "Updated",
  );
  assert.equal(older.messages[0].text, sample.messages[0].text);
  assert.ok(
    result.messages.every(
      (m, i, all) => !i || timestampCompare(all[i - 1].ts, m.ts) <= 0,
    ),
  );
});
test("timestamps retain fractional precision and sort numerically", () => {
  assert.ok(timestampCompare("99.9", "100.1") < 0);
  assert.ok(timestampCompare("100.000000000001", "100.000000000002") < 0);
  assert.equal(timestampCompare("100.1", "100.100"), 0);
});
test("Slack formatting resolves mentions and escapes imported HTML and unsafe links", () => {
  const format = createFormatting(() => mergeArchives([sample]));
  assert.equal(format.name({ user_id: "SAMPLE_A" }), "Alex Chen");
  const mentions = createFormatting(() => ({
    users: new Map([["U123", { display_name: "Alex Chen" }]]),
  }));
  assert.ok(mentions.rich("<@U123>").includes("@Alex Chen"));
  assert.equal(
    format.rich("<script>alert(1)</script>"),
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
  assert.equal(format.link("javascript:alert(1)", "Unsafe"), "Unsafe");
  assert.ok(format.rich("*bold* `code`").includes("<strong>bold</strong>"));
});

test("page renderer can render About, files, and threads with an imported archive", async () => {
  const { createRenderer } = await import("../src/ui/renderer.js");
  const elements = new Map();
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (!elements.has(id))
        elements.set(id, {
          value: "",
          innerHTML: "",
          textContent: "",
          hidden: false,
          scrollTop: 0,
          get scrollHeight() {
            return (this.innerHTML.match(/<article/g) || []).length * 100;
          },
        });
      return elements.get(id);
    },
    querySelectorAll() {
      return [];
    },
  };
  try {
    const state = {
      archives: [sample],
      selected: archiveKey(sample),
      activeChannel: channelKey(sample),
      view: "about",
      thread: null,
      limit: 150,
      data: mergeArchives([sample]),
    };
    const renderer = createRenderer(
      () => state,
      createFormatting(() => state.data),
    );
    renderer.render();
    assert.match(elements.get("content").innerHTML, /Archive coverage/);
    assert.match(elements.get("content").innerHTML, /Download original JSON/);
    state.view = "files";
    renderer.render();
    assert.match(elements.get("content").innerHTML, /Example attachment/);
    state.view = "threads";
    state.thread = sample.messages.find((m) => m.reply_count > 0).ts;
    renderer.render();
    assert.equal(elements.get("thread").hidden, false);
    assert.match(elements.get("thread").innerHTML, /2 archived replies/);
    state.view = "messages";
    state.thread = null;
    state.limit = 2;
    renderer.render();
    const content = elements.get("content");
    assert.ok(content.innerHTML.startsWith('<div class="loadOlder">'));
    assert.match(content.innerHTML, /Load older messages/);
    assert.ok(content.innerHTML.includes(sample.messages.at(-1).ts));
    assert.ok(!content.innerHTML.includes(sample.messages[0].ts));
    content.scrollTop = 20;
    state.limit = 3;
    renderer.render({ prepend: true });
    assert.equal(content.scrollTop, 120);
    assert.ok(content.innerHTML.includes(sample.messages[1].ts));
    state.limit = 150;
    renderer.render({ prepend: true });
    assert.ok(!content.innerHTML.includes('id="more"'));
    assert.ok(content.innerHTML.includes(sample.messages[0].ts));
    const { registerHosted, sourceKey } =
      await import("../src/archive/hosted.js");
    const shared = registerHosted(structuredClone(sample), "shared.json");
    state.archives = [shared, sample];
    state.selected = null;
    renderer.render();
    const sidebar = elements.get("archives").innerHTML;
    assert.match(sidebar, /data-toggle-hosted="hosted:shared.json"/);
    assert.equal((sidebar.match(/data-remove=/g) || []).length, 1);
    state.archives = [shared];
    state.disabled = new Set([sourceKey(shared)]);
    state.data = mergeArchives([]);
    renderer.render();
    assert.match(content.innerHTML, /No archives enabled/);
    assert.ok(!elements.get("archives").innerHTML.includes("data-remove="));
  } finally {
    globalThis.document = previousDocument;
  }
});

test("any workspace/channel is valid, while missing identity and timezone are rejected", () => {
  const other = structuredClone(sample);
  other.workspace = { id: "TOTHER", name: "Another workspace" };
  other.channel = { id: "COTHER", name: "support" };
  other.range.timezone = "Europe/London";
  assert.equal(validateArchive(other), other);
  assert.throws(
    () => validateArchive({ ...other, workspace: { id: "", name: "bad" } }),
    /workspace/,
  );
  assert.throws(
    () => validateArchive({ ...other, channel: { id: "COTHER" } }),
    /channel/,
  );
  assert.throws(
    () =>
      validateArchive({
        ...other,
        range: { ...other.range, timezone: "invalid/zone" },
      }),
    /timezone/,
  );
});

test("matching archive IDs, message timestamps, user IDs, and file IDs stay isolated by channel/workspace", async () => {
  const { scopedArchives, resolveChannel, listChannels, archiveFilename } =
    await import("../src/archive/selection.js");
  const otherChannel = structuredClone(sample);
  otherChannel.channel = { id: "COTHER", name: "support" };
  otherChannel.messages[0].text = "Support only";
  const otherWorkspace = structuredClone(otherChannel);
  otherWorkspace.workspace = { id: "TOTHER", name: "Another workspace" };
  otherWorkspace.messages[0].text = "Other workspace only";
  otherWorkspace.users[0].display_name = "Another person";
  otherWorkspace.files[0].title = "Another file";
  const archives = [sample, otherChannel, otherWorkspace];
  assert.equal(new Set(archives.map(archiveKey)).size, 3);
  assert.throws(
    () => mergeArchives(archives),
    /Select one workspace and channel/,
  );
  for (const a of archives) {
    const scope = scopedArchives(archives, channelKey(a));
    assert.deepEqual(scope, [a]);
    const merged = mergeArchives(scope);
    assert.equal(merged.messages[0].text, a.messages[0].text);
    assert.equal(
      merged.users.get(a.users[0].id).display_name,
      a.users[0].display_name,
    );
    assert.equal(merged.files.get(a.files[0].id).title, a.files[0].title);
  }
  assert.equal(listChannels(archives, sample.workspace.id).length, 2);
  assert.equal(resolveChannel(archives, "removed"), channelKey(sample));
  assert.match(archiveFilename(otherChannel), /^support-slack-archive-/);
});

test("latest export drives timezone, names, and date filters regardless of import order", () => {
  const newer = structuredClone(sample);
  newer.archive_id = "renamed";
  newer.exported_at = "2026-10-20T12:00:00Z";
  newer.workspace.name = "Renamed workspace";
  newer.channel.name = "renamed-channel";
  newer.range.timezone = "Asia/Tokyo";
  const data = mergeArchives([newer, sample]);
  assert.equal(data.workspace.name, "Renamed workspace");
  assert.equal(data.channel.name, "renamed-channel");
  const formatting = createFormatting(() => data);
  assert.equal(formatting.timezone(), "Asia/Tokyo");
  assert.equal(formatting.day("1791849600.000001"), "2026-10-13");
});
