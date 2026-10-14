# Slack Archive v1.0.0

UTF-8 JSON; timestamps in ISO 8601, except Slack ts/thread_ts values which MUST remain exact strings.
Filename: project-voltron-slack-archive-YYYY-MM-DD_to_YYYY-MM-DD.json. Both filename dates are inclusive, in America/New_York. range.end_exclusive is the following Monday at local midnight. Never use a fixed 168-hour subtraction across DST.

The template supplies required top-level fields. Arrays remain arrays even when empty. Unknown values are null, never guessed. Additional properties are preserved for forward compatibility; major schema versions require an explicit migration.

## Records

users[]: {id:string, name:string|null, display_name:string|null, real_name:string|null, avatar_url:string|null, raw:object|string|null}
messages[]: {ts:string, thread_ts:string|null, user_id:string|null, bot_id:string|null, author_name:string|null, type:string, subtype:string|null, text:string, blocks:array, attachments:array, files:array, reactions:array, reply_count:integer|null, edited:object|null, permalink:string|null, is_context:boolean, raw:object|string|null}
reactions[]: {name:string, count:integer, users:string[]|null}
messages[].files[]: complete available Slack file objects or {id:string}; resolve against top-level files by id.
files[]: {id:string, name:string|null, title:string|null, mimetype:string|null, size:integer|null, url_private:string|null, permalink:string|null, download_status:string, raw:object|string|null}. Preserve all extra supplied properties. Metadata and links are not a backup of file bytes. Never embed credentials or authenticated download headers.
events[]: {id:string, type:string, ts:string|null, message_ts:string|null, user_id:string|null, raw:object|string|null}. Include ONLY actual observed event records, never infer reaction/edit times from snapshot state.
raw_responses[]: {tool:string, fetched_at:string, request:object, response:object|string}. Preserve exact returned content, omit credentials/tokens. A formatted response is a string, not fabricated raw Slack JSON.
coverage: {status:"complete"|"partial"|"failed", history_exhausted:boolean, threads_exhausted:boolean, limitations:string[], errors:array, counts:{messages:integer,thread_replies:integer,files:integer,users:integer}}

Channel/user/message raw fields preserve the richest source actually returned. Attachments, blocks, file metadata, reactions, edit metadata, joins/leaves, bot/system records, pins/bookmarks/canvas/list metadata and channel state are retained when exposed. Unsupported metadata must be named in coverage.limitations.
Messages include all in-window activity that can be retrieved, plus older parent/context messages marked is_context:true. Read older thread roots to catch new replies. Snapshot changes to older messages may be retained as context with observed export time, never falsely labeled in-window events.
Weekly snapshots cannot guarantee deleted messages, prior edit versions, reactions removed before retrieval, historical membership changes, expired attachments, retention-limited content, or unavailable connector fields. Current connector formatting loses some raw fields. coverage.status must remain partial if these losses apply.

## Merge semantics

Archive identity is workspace ID + channel ID + range boundaries. Reimporting the same archive_id replaces that snapshot. Message identity is workspace ID + channel ID + exact ts. For overlaps, latest exported_at wins, independent of import order; original snapshots remain available. Thread replies link through thread_ts. A missing message is not a deletion event. Users/files merge by their Slack IDs within a workspace. Dates shown in New York time.

## Viewer

Import one or multiple archives. Browser IndexedDB persists originals; content is never uploaded. External links are opened only when clicked; avatars/images are not fetched automatically. Search is literal and case-insensitive across text and author, with author/date filters, threaded context, files, and metadata inspection. Export each original archive from About. Remove an archive from the sidebar to delete its local copy. Schema/template downloads are available in About.

