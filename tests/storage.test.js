import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { readFile } from "node:fs/promises";
import {
  openArchiveDatabase,
  readArchives,
  saveArchives,
} from "../src/archive/storage.js";
const sample = JSON.parse(
  await readFile(
    new URL("../public/archive/sample-conversation.json", import.meta.url),
  ),
);

test("legacy database upgrades without losing originals; matching IDs coexist in distinct channels/workspaces", async () => {
  globalThis.indexedDB = new IDBFactory();
  const legacy = await new Promise((resolve, reject) => {
    const request = indexedDB.open("voltron-archive-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("archives", { keyPath: "archive_id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await saveArchives(legacy, [sample]);
  legacy.close();
  const upgraded = await openArchiveDatabase();
  assert.deepEqual(await readArchives(upgraded), [sample]);
  const other = structuredClone(sample);
  other.channel = { id: "COTHER", name: "other" };
  const third = structuredClone(other);
  third.workspace = { id: "TOTHER", name: "Other workspace" };
  await saveArchives(upgraded, [sample, other, third]);
  assert.equal((await readArchives(upgraded)).length, 3);
  upgraded.close();
  const reopened = await openArchiveDatabase();
  assert.equal((await readArchives(reopened)).length, 3);
  await saveArchives(reopened, [sample, third]);
  assert.equal((await readArchives(reopened)).length, 2);
  reopened.close();
  delete globalThis.indexedDB;
});
