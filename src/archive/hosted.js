import { validateArchive, archiveKey } from "./model.js";
const sources = new WeakMap();
export function registerHosted(archive, filename) {
  sources.set(archive, filename);
  return archive;
}
export const isHosted = (archive) => sources.has(archive);
export const sourceKey = (archive) =>
  isHosted(archive) ? "hosted:" + sources.get(archive) : archiveKey(archive);
export const enabledArchives = (archives, disabled = new Set()) =>
  archives.filter((a) => !isHosted(a) || !disabled.has(sourceKey(a)));
export const browserArchives = (archives) =>
  archives.filter((a) => !isHosted(a));

export async function loadHostedArchives(fetcher = fetch) {
  const response = await fetcher("/archives/manifest.json", {
    cache: "no-store",
  });
  if (!response.ok)
    throw Error(
      "Could not discover shared archives (HTTP " + response.status + ").",
    );
  const names = await response.json();
  if (
    !Array.isArray(names) ||
    names.some(
      (name) =>
        typeof name !== "string" ||
        !name.toLowerCase().endsWith(".json") ||
        name.startsWith("/") ||
        name.includes("\\") ||
        name.split("/").some((part) => !part || part === "." || part === ".."),
    )
  )
    throw Error("Invalid shared archive manifest.");
  const results = await Promise.allSettled(
    [...new Set(names)].map(async (filename) => {
      const response = await fetcher(
        "/archives/" + filename.split("/").map(encodeURIComponent).join("/"),
        { cache: "no-store" },
      );
      if (!response.ok) throw Error("HTTP " + response.status);
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > 50 * 1024 * 1024)
        throw Error("File exceeds 50 MB.");
      return registerHosted(validateArchive(JSON.parse(text)), filename);
    }),
  );
  return {
    archives: results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value),
    errors: results.flatMap((result, i) =>
      result.status === "rejected"
        ? [[...new Set(names)][i] + ": " + result.reason.message]
        : [],
    ),
  };
}

const preferenceKey = "slack-archive-disabled-hosted";
export function readDisabledArchives(storage) {
  try {
    storage ??= globalThis.localStorage;
    const ids = JSON.parse(storage.getItem(preferenceKey) || "[]");
    return new Set(
      Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [],
    );
  } catch {
    return new Set();
  }
}
export function saveDisabledArchives(disabled, storage = localStorage) {
  storage.setItem(preferenceKey, JSON.stringify([...disabled]));
}
