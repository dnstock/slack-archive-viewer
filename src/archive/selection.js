import { sourceKey } from "./hosted.js";
import { channelKey } from "./model.js";
export function listChannels(archives, workspaceId) {
  const channels = new Map();
  for (const archive of [...archives].sort(
    (a, b) => Date.parse(a.exported_at) - Date.parse(b.exported_at),
  )) {
    if (!workspaceId || archive.workspace.id === workspaceId)
      channels.set(channelKey(archive), archive);
  }
  return [...channels.values()];
}
export function scopedArchives(archives, activeChannel, selected = null) {
  return archives.filter(
    (a) =>
      channelKey(a) === activeChannel &&
      (!selected || sourceKey(a) === selected),
  );
}
export function resolveChannel(archives, activeChannel) {
  return archives.some((a) => channelKey(a) === activeChannel)
    ? activeChannel
    : archives.length
      ? channelKey(archives[0])
      : null;
}
export function archiveFilename(a) {
  const slug =
    a.channel.name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") ||
    "channel";
  return `${slug}-slack-archive-${a.range.start_date}_to_${a.range.end_date}.json`;
}
