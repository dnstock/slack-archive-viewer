import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { serveArchiveRequest } from "./archive-files.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const webRoot = resolve(root, "dist");
const archiveDirectory = resolve(
  process.env.ARCHIVE_DIRECTORY || resolve(root, "archives"),
);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".md": "text/markdown",
};
await stat(resolve(webRoot, "index.html")).catch(() => {
  throw Error("Run npm run build before npm start.");
});
createServer(async (request, response) => {
  try {
    if (await serveArchiveRequest(request, response, archiveDirectory)) return;
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    const file = resolve(
      webRoot,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(webRoot + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const data = await readFile(file);
    response.setHeader(
      "Content-Type",
      (mime[extname(file)] || "application/octet-stream") + "; charset=utf-8",
    );
    response.end(request.method === "HEAD" ? undefined : data);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end("Unable to serve this file.");
  }
}).listen(port, host, () =>
  console.log(`Slack Archive Viewer: http://${host}:${port}`),
);
