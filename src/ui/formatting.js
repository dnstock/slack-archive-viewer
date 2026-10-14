import { esc } from "./dom.js";
export function createFormatting(getData) {
  const TZ = "America/New_York",
    date = (ts) => new Date(Number(ts) * 1000),
    day = (ts) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date(ts));
  const time = (ts) =>
    date(ts).toLocaleTimeString("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
    });
  const emoji = {
    thumbsup: "👍",
    "+1": "👍",
    heart: "❤️",
    joy: "😂",
    laughing: "😆",
    fire: "🔥",
    eyes: "👀",
    rocket: "🚀",
    white_check_mark: "✅",
    tada: "🎉",
    thinking_face: "🤔",
    100: "💯",
    wave: "👋",
    sunglasses: "😎",
    pray: "🙏",
  };
  const glyph = (name) => emoji[name] || ":" + name + ":";
  const name = (m) => {
    const u = getData().users.get(m.user_id);
    return (
      u?.display_name ||
      u?.real_name ||
      u?.name ||
      m.author_name ||
      m.user_id ||
      m.bot_id ||
      "Unknown author"
    );
  };
  function safeURL(u) {
    try {
      const x = new URL(u);
      return ["http:", "https:"].includes(x.protocol) ? x.href : null;
    } catch {
      return null;
    }
  }
  function link(u, label) {
    const v = safeURL(u);
    return v
      ? `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${esc(label || u)}</a>`
      : esc(label || u);
  }
  function rich(text) {
    const tokens = [];
    const put = (s) => {
      tokens.push(s);
      return "\u0000" + (tokens.length - 1) + "\u0000";
    };
    let s = String(text).replace(/\u0000/g, "");
    s = s
      .replace(/```([\s\S]*?)```/g, (_, x) =>
        put("<pre><code>" + esc(x) + "</code></pre>"),
      )
      .replace(/`([^`\n]+)`/g, (_, x) => put("<code>" + esc(x) + "</code>"))
      .replace(/<@([A-Z0-9]+)(?:\|[^>]*)?>/g, (_, id) =>
        put("<b>@" + esc(name({ user_id: id })) + "</b>"),
      )
      .replace(/<#([A-Z0-9]+)(?:\|([^>]+))?>/g, (_, id, n) =>
        put("<b>#" + esc(n || id) + "</b>"),
      )
      .replace(/<(https?:[^>|]+)(?:\|([^>]*))?>/g, (_, u, l) => put(link(u, l)))
      .replace(/https?:\/\/[^\s<>\u0000]+/g, (u) => put(link(u, u)));
    s = esc(s)
      .replace(/&amp;(amp|lt|gt);/g, "&$1;")
      .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
      .replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1<em>$2</em>")
      .replace(/~([^~\n]+)~/g, "<s>$1</s>")
      .replace(/:([a-z0-9_+-]+):/g, (all, n) => emoji[n] || all)
      .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
  }
  return { TZ, date, day, time, glyph, name, safeURL, link, rich };
}
