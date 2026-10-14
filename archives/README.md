# Shared archives

Place Slack archive JSON files here (schema version 1.0.0). Subfolders are supported.
The app loads them at startup. Users can enable/disable them but cannot delete them from the viewer.

`npm run dev` and `npm start` discover current files on each page load. A static production build includes the files present when you run `npm run build`.
For persistent hosting, mount this directory on durable storage or set `ARCHIVE_DIRECTORY` to that directory when running `npm start`.
