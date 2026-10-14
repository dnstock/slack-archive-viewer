import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function listArchiveFiles(directory, prefix = "") {
  let entries;
  try {
    entries = await readdir(join(directory, prefix), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      files.push(...(await listArchiveFiles(directory, name)));
    else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".json") &&
      name !== "manifest.json"
    )
      files.push(name);
  }
  return files.sort();
}

// Both development and the live server use the same folder discovery route.
export async function serveArchiveRequest(request, response, directory) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (!pathname.startsWith("/archives/")) return false;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return true;
  }
  try {
    const name = decodeURIComponent(pathname.slice("/archives/".length));
    const files = await listArchiveFiles(directory);
    if (name !== "manifest.json" && !files.includes(name)) {
      response.writeHead(404);
      response.end();
      return true;
    }
    const body =
      name === "manifest.json"
        ? JSON.stringify(files)
        : await readFile(join(directory, name));
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(500);
    response.end(JSON.stringify({ error: "Unable to read archive folder." }));
  }
  return true;
}
