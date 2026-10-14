export const timestampCompare = (a, b) => {
  const [ai, af = ""] = a.split("."),
    [bi, bf = ""] = b.split(".");
  return (
    ai.length - bi.length ||
    ai.localeCompare(bi) ||
    af.padEnd(12, "0").localeCompare(bf.padEnd(12, "0"))
  );
};
export function validateArchive(a) {
  const fail = (s) => {
    throw Error(s);
  };
  if (!a || typeof a !== "object" || Array.isArray(a))
    fail("Expected an archive object.");
  if (a.schema_version !== "1.0.0")
    fail(
      "Unsupported schema_version. Expected 1.0.0. See About for the format.",
    );
  if (
    typeof a.archive_id !== "string" ||
    !a.archive_id ||
    !Number.isFinite(Date.parse(a.exported_at))
  )
    fail("Missing archive_id or valid exported_at.");
  if (a.workspace?.id !== "T8PPK7S5V" || a.channel?.id !== "C0BFZG5FBQD")
    fail("This viewer expects Friends of Jibe / #project-voltron.");
  for (const k of ["users", "messages", "files", "events", "raw_responses"])
    if (!Array.isArray(a[k])) fail(k + " must be an array.");
  if (
    !a.range ||
    !/^\d{4}-\d{2}-\d{2}$/.test(a.range.start_date) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(a.range.end_date) ||
    !(Date.parse(a.range.end_exclusive) > Date.parse(a.range.start))
  )
    fail("Invalid archive date range.");
  if (
    !a.coverage ||
    !["complete", "partial", "failed"].includes(a.coverage.status) ||
    !Array.isArray(a.coverage.limitations) ||
    !Array.isArray(a.coverage.errors)
  )
    fail("Missing coverage report.");
  const ids = new Set();
  for (const m of a.messages) {
    if (
      !m ||
      typeof m.ts !== "string" ||
      !/^\d{1,12}\.\d{1,12}$/.test(m.ts) ||
      typeof m.text !== "string"
    )
      fail("Each message needs an exact string ts and text.");
    if (ids.has(m.ts)) fail("Duplicate message ts " + m.ts);
    ids.add(m.ts);
    if (
      m.thread_ts != null &&
      (typeof m.thread_ts !== "string" ||
        !/^\d{1,12}\.\d{1,12}$/.test(m.thread_ts))
    )
      fail("Invalid thread_ts.");
    for (const k of ["blocks", "attachments", "files", "reactions"])
      if (!Array.isArray(m[k]))
        fail("Message " + m.ts + ": " + k + " must be an array.");
    for (const r of m.reactions)
      if (
        !r ||
        typeof r.name !== "string" ||
        !Number.isInteger(r.count) ||
        r.count < 0
      )
        fail("Invalid reaction.");
    for (const f of m.files)
      if (!f || typeof f !== "object" || typeof f.id !== "string")
        fail("Invalid message file.");
    for (const r of m.attachments)
      if (!r || typeof r !== "object") fail("Invalid attachment.");
  }
  for (const key of ["users", "files"])
    for (const x of a[key])
      if (!x || typeof x.id !== "string") fail(key + " records require an id.");
  return a;
}
export function mergeArchives(archives) {
  const messages = new Map(),
    users = new Map(),
    files = new Map();
  for (const a of [...archives].sort(
    (a, b) =>
      Date.parse(a.exported_at) - Date.parse(b.exported_at) ||
      a.archive_id.localeCompare(b.archive_id),
  )) {
    for (const u of a.users) users.set(u.id, u);
    for (const f of a.files) files.set(f.id, f);
    for (const m of a.messages) messages.set(m.ts, m);
  }
  return {
    messages: [...messages.values()].sort((a, b) =>
      timestampCompare(a.ts, b.ts),
    ),
    users,
    files,
  };
}
