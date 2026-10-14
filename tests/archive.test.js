import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateArchive,
  mergeArchives,
  timestampCompare,
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
      selected: sample.archive_id,
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
  } finally {
    globalThis.document = previousDocument;
  }
});
