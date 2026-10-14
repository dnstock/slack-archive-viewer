import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listArchiveFiles,
  serveArchiveRequest,
} from "../server/archive-files.js";
import {
  loadHostedArchives,
  isHosted,
  sourceKey,
  enabledArchives,
  browserArchives,
  registerHosted,
  readDisabledArchives,
  saveDisabledArchives,
} from "../src/archive/hosted.js";
import { scopedArchives } from "../src/archive/selection.js";
import { channelKey, mergeArchives } from "../src/archive/model.js";
const sample = JSON.parse(
  await readFile(
    new URL("../public/archive/sample-conversation.json", import.meta.url),
  ),
);

test("folder discovery finds added files, nested JSON, and ignores non-JSON and symlinks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "archive-folder-"));
  try {
    await mkdir(join(dir, "nested"));
    await writeFile(join(dir, "nested", "one.json"), JSON.stringify(sample));
    await writeFile(join(dir, "notes.md"), "Not an archive");
    await symlink(join(dir, "nested", "one.json"), join(dir, "link.json"));
    assert.deepEqual(await listArchiveFiles(dir), ["nested/one.json"]);
    await writeFile(join(dir, "new.json"), JSON.stringify(sample));
    assert.deepEqual(await listArchiveFiles(dir), [
      "nested/one.json",
      "new.json",
    ]);
    let body,
      status = 200;
    const response = {
      setHeader() {},
      writeHead(code) {
        status = code;
      },
      end(value) {
        body = value;
      },
    };
    assert.equal(
      await serveArchiveRequest(
        { url: "/archives/manifest.json", method: "GET" },
        response,
        dir,
      ),
      true,
    );
    assert.deepEqual(JSON.parse(body), ["nested/one.json", "new.json"]);
    await serveArchiveRequest(
      { url: "/archives/nested/one.json", method: "GET" },
      response,
      dir,
    );
    assert.deepEqual(JSON.parse(body), sample);
    await serveArchiveRequest(
      { url: "/archives/%2e%2e%2foutside.json", method: "GET" },
      response,
      dir,
    );
    assert.equal(status, 404);
    assert.equal(
      await serveArchiveRequest(
        { url: "/index.html", method: "GET" },
        response,
        dir,
      ),
      false,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("startup loads shared archives independently and reports invalid files", async () => {
  const fetcher = async (url) =>
    url.endsWith("manifest.json")
      ? { ok: true, json: async () => ["one.json", "broken.json", "one.json"] }
      : {
          ok: true,
          text: async () =>
            url.endsWith("one.json") ? JSON.stringify(sample) : "{}",
        };
  const loaded = await loadHostedArchives(fetcher);
  assert.equal(loaded.archives.length, 1);
  assert.equal(isHosted(loaded.archives[0]), true);
  assert.equal(sourceKey(loaded.archives[0]), "hosted:one.json");
  assert.equal(loaded.errors.length, 1);
  assert.match(loaded.errors[0], /broken.json/);
  await assert.rejects(
    loadHostedArchives(async () => ({
      ok: true,
      json: async () => ["../outside.json"],
    })),
    /Invalid shared archive manifest/,
  );
});

test("disabling shared snapshots excludes their content without losing browser imports or originals", () => {
  const shared = registerHosted(structuredClone(sample), "one.json");
  const local = structuredClone(sample);
  local.exported_at = "2026-10-20T12:00:00Z";
  local.messages[0].text = "Newer browser import";
  const archives = [shared, local];
  assert.equal(
    mergeArchives(archives).messages[0].text,
    "Newer browser import",
  );
  const disabled = new Set([sourceKey(shared)]);
  assert.deepEqual(enabledArchives(archives, disabled), [local]);
  assert.deepEqual(browserArchives(archives), [local]);
  assert.deepEqual(
    scopedArchives(archives, channelKey(shared), sourceKey(shared)),
    [shared],
  );
  assert.deepEqual(
    scopedArchives(archives, channelKey(local), sourceKey(local)),
    [local],
  );
  const storage = {
    value: null,
    getItem() {
      return this.value;
    },
    setItem(_, value) {
      this.value = value;
    },
  };
  saveDisabledArchives(disabled, storage);
  assert.deepEqual(readDisabledArchives(storage), disabled);
  storage.value = "broken";
  assert.equal(readDisabledArchives(storage).size, 0);
});
