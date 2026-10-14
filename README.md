# Slack Archive Viewer

A local, read-only archive viewer with a Slack-like interface. Import one or more JSON archives, search and filter messages, browse threads and attachments, inspect metadata, and download original snapshots. Imported data stays in browser IndexedDB.

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
- `tests/`: import, merge, timestamp, and formatting regression tests.

## Archive compatibility

Imports use schema version `1.0.0`. Workspace and channel IDs and names come from each archive's JSON. Import archives from multiple workspaces/channels and choose a workspace in the top bar and a channel in the sidebar (or the channel selector on narrow screens). Search, threads, files, and About are scoped to that channel; selecting a snapshot narrows it further. Arbitrary native Slack export JSON is not automatically converted. See `public/archive/` for the supported format.

Overlapping messages are deduplicated by workspace, channel, and exact Slack timestamp; the latest export wins. Dates use the active archive’s `range.timezone`; the newest export supplies the timezone and display metadata. Individual imports are limited to 50 MB. Existing saved archives remain accessible through the unchanged `voltron-archive-v1` database, upgraded in place to compound workspace/channel/archive keys. Keep original JSON files; clearing browser data removes local copies. The sample conversation is never persisted.
