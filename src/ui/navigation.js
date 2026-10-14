import { $, esc } from "./dom.js";
import { channelKey } from "../archive/model.js";
import { listChannels } from "../archive/selection.js";

export function renderNavigation(state) {
  const { archives, activeChannel } = state;
  const allChannels = listChannels(archives);
  const current = allChannels.find((a) => channelKey(a) === activeChannel);
  const workspace = current?.workspace;
  const workspaces = new Map(
    allChannels.map((a) => [a.workspace.id, a.workspace]),
  );
  $("workspaceSelect").innerHTML =
    [...workspaces.values()]
      .map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`)
      .join("") || "<option>No workspaces imported</option>";
  $("workspaceSelect").disabled = !archives.length;
  $("workspaceSelect").value = workspace?.id || "";
  $("workspaceName").textContent = workspace?.name || "Slack Archives";
  $("workspaceBadge").textContent =
    workspace?.name
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "SA";
  const channels = workspace ? listChannels(archives, workspace.id) : [];
  $("channels").innerHTML =
    channels
      .map(
        (a) =>
          `<button class="channel ${channelKey(a) === activeChannel ? "selected" : ""}" data-channel="${esc(channelKey(a))}"># &nbsp; ${esc(a.channel.name)}</button>`,
      )
      .join("") ||
    '<p class="navigationHint">Import an archive to see its channels.</p>';
  $("channelSelect").innerHTML =
    channels
      .map(
        (a) =>
          `<option value="${esc(channelKey(a))}"># ${esc(a.channel.name)}</option>`,
      )
      .join("") || "<option>No channels imported</option>";
  $("channelSelect").disabled = !channels.length;
  $("channelSelect").value = activeChannel || "";
  $("channelTitle").textContent = current
    ? "# " + current.channel.name
    : "Slack Archive Viewer";
  $("channelWorkspace").textContent = workspace
    ? workspace.name + " / Archive viewer"
    : "Import JSON archives to begin";
  $("search").placeholder = workspace
    ? "Search " + workspace.name
    : "Search archived messages";
  $("allNav").textContent = "▣ All channel messages";
  document.title = current
    ? `#${current.channel.name} · ${workspace.name} · Slack Archive Viewer`
    : "Slack Archive Viewer";
}
