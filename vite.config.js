import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  listArchiveFiles,
  serveArchiveRequest,
} from "./server/archive-files.js";
const archiveDirectory = fileURLToPath(new URL("./archives/", import.meta.url));
export default defineConfig({
  plugins: [
    {
      name: "shared-archive-folder",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          serveArchiveRequest(request, response, archiveDirectory)
            .then((handled) => {
              if (!handled) next();
            })
            .catch(next);
        });
      },
      async generateBundle() {
        const files = await listArchiveFiles(archiveDirectory);
        this.emitFile({
          type: "asset",
          fileName: "archives/manifest.json",
          source: JSON.stringify(files),
        });
        for (const name of files)
          this.emitFile({
            type: "asset",
            fileName: "archives/" + name,
            source: await readFile(join(archiveDirectory, name)),
          });
      },
    },
  ],
});
