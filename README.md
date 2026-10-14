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
- `src/archive/storage.js`: browser database access.
- `src/ui/renderer.js`: message, file, thread, archive list, and page rendering.
- `src/ui/formatting.js`: Slack text formatting, author names, safe links, and dates.
- `src/ui/dom.js`: DOM lookup and HTML escaping.
- `src/styles/app.css`: Slack-like layout, component styles, and responsive rules.
- `public/archive/`: downloadable format documentation, schema, template, and fictional sample.
- `tests/`: import, merge, timestamp, and formatting regression tests.

## Archive compatibility

The existing import contract is preserved: schema version `1.0.0`, Friends of Jibe workspace `T8PPK7S5V`, and channel `C0BFZG5FBQD` (`project-voltron`). Arbitrary Slack export JSON is not automatically converted. See `public/archive/` for the supported format.

Overlapping messages are deduplicated by exact Slack timestamp; the latest export wins. Dates use `America/New_York`. Individual imports are limited to 50 MB. Existing saved archives remain accessible through the unchanged `voltron-archive-v1` database. Keep original JSON files; clearing browser data removes local copies. The sample conversation is never persisted.
