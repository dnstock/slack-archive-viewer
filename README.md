# Slack Archive Viewer

A read-only archive viewer with a Slack-like interface. Import one or more JSON archives, search and filter messages, browse threads and attachments, inspect metadata, and download original snapshots. Manual imports stay in browser IndexedDB; deployment-managed archives load from the server.

## Development

Use Node.js 22.12 or later (or 20.19 or later).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use an HTTP server rather than opening `index.html` directly: the app uses JavaScript modules and fetches the sample archive.

```sh
npm test
npm run build
npm run preview
```

The production build is written to `dist/` and can be served by a static host.

## Deployment-managed archives

Put schema-compatible JSON files in `archives/` (subfolders are supported). Every file is automatically loaded at startup and marked **Shared** in Imported archives. Its checkbox enables/disables it for the current browser without deleting the file. Preferences survive reloads. On mobile, use the **Archives** button to manage these choices. Browser imports still work and remain removable.

For a live deployment with a persistent archive folder:

```sh
npm run build
npm start
```

The live server scans the folder on every app startup, so newly added or updated files are picked up on the next page load without rebuilding. Remove a shared archive by removing its JSON file on the server. To mount a durable folder and expose the server in a hosting container:

```sh
ARCHIVE_DIRECTORY=/data/slack-archives HOST=0.0.0.0 PORT=3000 npm start
```

The host must retain `/data/slack-archives` across restarts/deployments. Shared archives are served to visitors of the app; use your hosting platform’s access controls if they contain private channel history. Manual imports are never uploaded to this folder.

Static hosting also works: `npm run build` copies the current folder to `dist/archives/` and generates its discovery manifest. Adding files to a static deployment requires rebuilding/redeploying (or regenerating `dist/archives/manifest.json`, a JSON array of relative JSON filenames). Browsers cannot list a server directory by themselves. The dev server also discovers files automatically.

Unreadable or invalid shared files are reported without blocking valid files or browser imports. If a shared snapshot and a browser import have the same identity, both originals remain available and the newest export wins in the merged channel view.

## Structure

- `index.html`: accessible application shell and entry point.
- `src/main.js`: application state, startup, import workflow, and event handling.
- `src/archive/model.js`: archive validation, exact timestamp ordering, and snapshot merging.
- `src/archive/selection.js`: workspace/channel scoping, archive identity, and download names.
- `src/ui/navigation.js`: data-driven workspace/channel navigation and headers.
- `src/archive/storage.js`: browser database access.
- `src/ui/renderer.js`: message, file, thread, archive list, and page rendering.
- `src/ui/formatting.js`: Slack text formatting, author names, safe links, and dates.
- `src/ui/dom.js`: DOM lookup and HTML escaping.
- `src/styles/app.css`: Slack-like layout, component styles, and responsive rules.
- `public/archive/`: downloadable format documentation, schema, template, and fictional sample.
- `archives/`: deployment-managed JSON archive folder.
- `server/`: live static server and archive-folder discovery.
- `src/archive/hosted.js`: shared archive loading, source identity, and enable/disable preferences.
- `vite.config.js`: dev discovery and static-build archive manifest generation.
- `tests/`: import, merge, timestamp, and formatting regression tests.

## Archive compatibility

Imports use schema version `1.0.0`. Workspace and channel IDs and names come from each archive's JSON. Import archives from multiple workspaces/channels and choose a workspace in the top bar and a channel in the sidebar (or the channel selector on narrow screens). Search, threads, files, and About are scoped to that channel; selecting a snapshot narrows it further. Arbitrary native Slack export JSON is not automatically converted. See `public/archive/` for the supported format.

Overlapping messages are deduplicated by workspace, channel, and exact Slack timestamp; the latest export wins. Dates use the active archive’s `range.timezone`; the newest export supplies the timezone and display metadata. Individual imports are limited to 50 MB. Existing saved archives remain accessible through the unchanged `voltron-archive-v1` database, upgraded in place to compound workspace/channel/archive keys. Keep original JSON files; clearing browser data removes local copies. The sample conversation is never persisted.
