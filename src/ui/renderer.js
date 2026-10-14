import { $, esc } from "./dom.js";
export function createRenderer(getState, formatting) {
  const { TZ, date, day, time, glyph, name, link, rich } = formatting;
  function chosen() {
    const { archives, selected } = getState();
    return selected
      ? archives.filter((archive) => archive.archive_id === selected)
      : archives;
  }
  function passes(m) {
    const q = $("search").value.toLowerCase(),
      p = $("person").value,
      d = day(m.ts);
    return (
      (!q || (m.text + " " + name(m)).toLowerCase().includes(q)) &&
      (!p || (m.user_id || m.bot_id || m.author_name || "") === p) &&
      (!$("from").value || d >= $("from").value) &&
      (!$("to").value || d <= $("to").value)
    );
  }
  function fileCard(f) {
    const { data } = getState();
    f = { ...data.files.get(f.id), ...f };
    const url = f.permalink || f.url_private || f.url_private_download;
    return `<div class="fileCard"><span class="fileIcon">▤</span><div>${url ? link(url, f.title || f.name || f.id) : esc(f.title || f.name || f.id)}<small>${esc(f.mimetype || f.filetype || "Attachment")} ${f.size ? " · " + Math.ceil(f.size / 1024) + " KB" : ""} · ${esc(f.download_status || "Linked file; Slack access may be required")}</small></div></div>`;
  }
  function message(m, inThread = false) {
    const { data } = getState();
    const n = name(m),
      initials = n
        .split(/\s+/)
        .slice(0, 2)
        .map((x) => x[0])
        .join("")
        .toUpperCase(),
      h = [...n].reduce((v, c) => v + c.charCodeAt(0), 0) % 360;
    const replies = data.messages.filter(
      (x) => x.thread_ts === m.ts && x.ts !== m.ts,
    );
    const parent = m.thread_ts && m.thread_ts !== m.ts;
    return `<article class="message"><div class="avatar" style="background:hsl(${h},25%,44%)">${esc(initials)}</div><div class="messageBody"><span class="author">${esc(n)}</span><span class="time" title="${esc(date(m.ts).toLocaleString("en-US", { timeZone: TZ }))} New York">${esc(time(m.ts))}</span>${m.edited ? '<span class="time">(edited)</span>' : ""}${m.is_context ? '<span class="time">context</span>' : ""}<div class="messageText">${rich(m.text)}</div>${m.attachments.map((a) => `<div class="attachment">${a.title ? (a.title_link ? link(a.title_link, a.title) : "<b>" + esc(a.title) + "</b>") : ""}${a.text ? "<div>" + rich(a.text) + "</div>" : !a.title ? esc(a.fallback || "Attachment metadata available in ⋯") : ""}${Array.isArray(a.fields) ? a.fields.map((f) => "<div><b>" + esc(f.title) + "</b> " + esc(f.value) + "</div>").join("") : ""}</div>`).join("")}${m.files.map(fileCard).join("")}${m.reactions.length ? '<div class="reactions">' + m.reactions.map((r) => `<span class="reaction" title="${esc((r.users || []).map((id) => name({ user_id: id })).join(", ") || r.name + " · reactors unavailable")}">${esc(glyph(r.name))} ${r.count}</span>`).join("") + "</div>" : ""}${!inThread && (replies.length || m.reply_count || parent) ? `<button class="replies" data-thread="${esc(parent ? m.thread_ts : m.ts)}">${parent ? "↳ View thread" : replies.length + " archived " + (replies.length === 1 ? "reply" : "replies") + (m.reply_count > replies.length ? " · " + m.reply_count + " in Slack" : "")} →</button>` : ""}</div><button class="metadataBtn" data-meta="${esc(m.ts)}" title="View message metadata">⋯</button></article>`;
  }
  function empty() {
    return `<section class="empty"><div class="emptyIcon">#</div><div class="eyebrow">THE PROJECT VOLTRON ARCHIVE</div><h2>Good conversations.<br>A longer memory.</h2><p>Bring your channel history back to life.<br>Import a weekly JSON archive to browse messages,<br>follow threads, and find that one thing someone said.</p><button class="primary" data-import>↥ &nbsp; Import your first archive</button><button class="secondary" id="demoButton">Explore with a sample conversation →</button><p class="hint">Drop one or more .json files anywhere.<br>Your archives stay on this device.</p></section>`;
  }
  function render() {
    const { archives, selected, view, thread, limit, data } = getState();

    $("archiveCount").textContent = archives.length;
    $("channelCount").textContent = data.messages.length;
    $("archives").innerHTML = archives.length
      ? archives
          .map(
            (a) =>
              `<div class="archiveEntry ${selected === a.archive_id ? "active" : ""}"><button class="range" data-archive="${esc(a.archive_id)}">▣ &nbsp; ${esc(a.range.start_date)}<small>through ${esc(a.range.end_date)} · ${a.messages.length} messages · ${esc(a.coverage.status)}</small></button><button class="remove" data-remove="${esc(a.archive_id)}" title="Remove local archive">×</button></div>`,
          )
          .join("")
      : '<p style="font-size:12px;color:#99859b;padding:0 9px;line-height:1.6">Your weekly archives<br>will appear here.</p>';
    document
      .querySelectorAll(".tab")
      .forEach((b) => b.classList.toggle("selected", b.dataset.view === view));
    const filtered = data.messages.filter(passes);
    $("resultCount").textContent = filtered.length + " messages";
    if (!archives.length) {
      $("content").innerHTML = empty();
      $("thread").hidden = true;
      return;
    }
    if (view === "about") {
      $("content").innerHTML =
        `<div class="infoPage"><div class="eyebrow">A RECORD, NOT A LIVE WORKSPACE</div><h2>Your channel, on your terms.</h2><p>Original JSON archives are stored in this browser’s IndexedDB. No imported data is uploaded. Clear browser data and these local copies will disappear; keep your exported files.</p><p>Dates and times use <b>America/New_York</b>. Overlapping messages are deduplicated by Slack timestamp; the newest export wins. Each original snapshot remains intact.</p><p><a href="/archive/archive-format.md" download="archive-format.md">Download format specification</a> · <a href="/archive/archive-template.json" download="archive-template.json">JSON template</a> · <a href="/archive/archive.schema.json" download="archive.schema.json">JSON Schema</a></p><h3>Archive coverage</h3>${chosen()
          .map(
            (a) =>
              `<div class="attachment"><b>${esc(a.range.start_date)} → ${esc(a.range.end_date)} · ${esc(a.coverage.status)}</b><p>${esc(a.coverage.limitations.join("\n") || "No limitations reported by the exporter.")}</p><button class="outline" data-export="${esc(a.archive_id)}">Download original JSON</button> <button data-archive-meta="${esc(a.archive_id)}">Inspect all metadata</button></div>`,
          )
          .join(
            "",
          )}<p>Weekly snapshots cannot reconstruct deleted messages, historical edit versions, or reaction changes that Slack no longer exposes. File links may expire or require Slack access.</p></div>`;
    } else if (view === "files") {
      const fs = new Map();
      if (
        !$("search").value &&
        !$("person").value &&
        !$("from").value &&
        !$("to").value
      )
        for (const f of data.files.values()) fs.set(f.id, f);
      for (const m of filtered)
        for (const f of m.files)
          fs.set(f.id, { ...data.files.get(f.id), ...f });
      $("content").innerHTML =
        '<div class="infoPage"><h2>Shared files</h2><p>Attachments from the selected archive and message filters. Links open the original file.</p>' +
        ([...fs.values()].map(fileCard).join("") ||
          "<p>No files in this selection.</p>") +
        "</div>";
    } else {
      const hasFilter =
        $("search").value ||
        $("person").value ||
        $("from").value ||
        $("to").value;
      let list;
      if (view === "threads") {
        const roots = new Set(
          filtered
            .map((m) =>
              m.thread_ts && m.thread_ts !== m.ts
                ? m.thread_ts
                : m.reply_count
                  ? m.ts
                  : null,
            )
            .filter(Boolean),
        );
        for (const m of filtered)
          if (data.messages.some((r) => r.thread_ts === m.ts && r.ts !== m.ts))
            roots.add(m.ts);
        list = data.messages.filter((m) => roots.has(m.ts));
      } else
        list = hasFilter
          ? filtered
          : data.messages.filter(
              (m) =>
                !m.thread_ts ||
                m.thread_ts === m.ts ||
                !data.messages.some((p) => p.ts === m.thread_ts),
            );
      let last = "";
      $("content").innerHTML =
        list
          .slice(0, limit)
          .map((m) => {
            let divider = "";
            if (day(m.ts) !== last) {
              last = day(m.ts);
              divider =
                '<div class="dateDivider"><span>' +
                esc(
                  date(m.ts).toLocaleDateString("en-US", {
                    timeZone: TZ,
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }),
                ) +
                "</span></div>";
            }
            return divider + message(m);
          })
          .join("") +
          (list.length > limit
            ? '<div style="text-align:center;padding:20px"><button class="outline" id="more">Load more messages</button></div>'
            : "") ||
        '<div class="empty"><h2>No messages found</h2><p>Try a different search or clear the filters.</p><button class="outline" id="clearEmpty">Clear filters</button></div>';
    }
    renderThread();
  }
  function renderThread() {
    const { thread, data } = getState();
    if (!thread) {
      $("thread").hidden = true;
      return;
    }
    const root = data.messages.find((m) => m.ts === thread),
      replies = data.messages.filter(
        (m) => m.thread_ts === thread && m.ts !== thread,
      );
    $("thread").hidden = false;
    $("thread").innerHTML =
      '<div class="threadHeader"><b>Thread <span class="time"># project-voltron</span></b><button id="closeThread" aria-label="Close thread">✕</button></div>' +
      (root
        ? message(root, true)
        : '<p class="threadHint">Parent message was not included in these archives.</p>') +
      `<p class="threadHint">${replies.length} archived replies${root?.reply_count > replies.length ? " · some replies are outside this archive" : ""}</p>` +
      replies.map((m) => message(m, true)).join("") +
      '<p class="threadHint">You’re reading an archived conversation.</p>';
  }
  return { render, renderThread };
}
