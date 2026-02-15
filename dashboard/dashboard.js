/**
 * Dashboard Script — Full analytics dashboard.
 *
 * Displays:
 *  - Global summary cards
 *  - Category distribution pie chart (canvas)
 *  - Playlist breakdown table with search/sort
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#3ea6ff", "#f5c518", "#ff4e45", "#4caf50", "#ab47bc",
  "#ff7043", "#26c6da", "#ec407a", "#66bb6a", "#ffa726",
  "#8d6e63", "#78909c", "#5c6bc0", "#29b6f6", "#d4e157",
  "#ef5350", "#7e57c2", "#26a69a", "#ffee58", "#bdbdbd"
];

// ─── DOM References ──────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const data = await chrome.storage.local.get([
    "globalStats",
    "playlistStats",
    "playlistMeta",
    "lastSync"
  ]);

  if (!data.globalStats || !data.playlistStats) {
    showEmptyState();
    return;
  }

  renderSummary(data.globalStats);
  renderPieChart(data.globalStats.categoryDistribution);
  renderTable(data.playlistStats, data.playlistMeta || {});
  renderLastSync(data.lastSync);

  bindEvents(data.playlistStats, data.playlistMeta || {});
});

// ─── Summary Cards ───────────────────────────────────────────────────────────

function renderSummary(globalStats) {
  $("#g-playlists").textContent = globalStats.totalPlaylists;
  $("#g-videos").textContent = globalStats.totalVideos;

  const cats = Object.keys(globalStats.categoryDistribution);
  $("#g-categories").textContent = cats.length;

  // Top category
  const top = Object.entries(globalStats.categoryDistribution)
    .sort((a, b) => b[1] - a[1])[0];
  $("#g-top-category").textContent = top ? top[0] : "—";
}

// ─── Pie Chart (Pure Canvas) ─────────────────────────────────────────────────

function renderPieChart(distribution) {
  const canvas = $("#pie-chart");
  const ctx = canvas.getContext("2d");
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, c]) => s + c, 0);

  if (total === 0) return;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 10;

  let startAngle = -Math.PI / 2;

  entries.forEach(([label, count], idx) => {
    const sliceAngle = (count / total) * 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[idx % CHART_COLORS.length];
    ctx.fill();

    startAngle += sliceAngle;
  });

  // Center hole (donut)
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.55, 0, 2 * Math.PI);
  ctx.fillStyle = "#181818";
  ctx.fill();

  // Center text
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(total.toString(), cx, cy - 8);
  ctx.font = "11px Segoe UI, Roboto, sans-serif";
  ctx.fillStyle = "#888";
  ctx.fillText("videos", cx, cy + 14);

  // Legend
  const legendEl = $("#pie-legend");
  legendEl.innerHTML = entries.map(([label, count], idx) => {
    const pct = ((count / total) * 100).toFixed(1);
    return `
      <div class="legend-item">
        <span class="legend-color" style="background:${CHART_COLORS[idx % CHART_COLORS.length]}"></span>
        <span class="legend-label">${escapeHtml(label)}</span>
        <span class="legend-count">${count} (${pct}%)</span>
      </div>
    `;
  }).join("");
}

// ─── Playlist Table ──────────────────────────────────────────────────────────

let currentSort = "ratio";
let currentSearch = "";

function renderTable(playlistStats, playlistMeta) {
  const tbody = $("#playlist-tbody");
  let rows = Object.entries(playlistStats).map(([pid, stats]) => ({
    id: pid,
    name: playlistMeta[pid]?.title || pid,
    totalVideos: stats.totalVideos,
    dominantCategory: stats.dominantCategory || "—",
    dominantRatio: stats.dominantRatio || 0,
    focusLabel: stats.focusLabel || "Empty"
  }));

  // Filter
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    rows = rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.dominantCategory.toLowerCase().includes(q)
    );
  }

  // Sort
  switch (currentSort) {
    case "name":
      rows.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "videos":
      rows.sort((a, b) => b.totalVideos - a.totalVideos);
      break;
    case "ratio":
      rows.sort((a, b) => b.dominantRatio - a.dominantRatio);
      break;
    case "focus":
      rows.sort((a, b) => focusOrder(a.focusLabel) - focusOrder(b.focusLabel));
      break;
  }

  tbody.innerHTML = rows.map(r => {
    const pct = (r.dominantRatio * 100).toFixed(0);
    const barColor = r.dominantRatio >= 0.8 ? "#4caf50" :
                     r.dominantRatio >= 0.5 ? "#3ea6ff" : "#ff9800";
    const badgeClass = r.focusLabel === "Highly Focused" ? "badge-highly-focused" :
                       r.focusLabel === "Focused" ? "badge-focused" : "badge-mixed";

    return `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${r.totalVideos}</td>
        <td>${escapeHtml(r.dominantCategory)}</td>
        <td>
          <div class="dominance-cell">
            <span class="dominance-bar-wrap">
              <span class="dominance-bar" style="width:${pct}%; background:${barColor}"></span>
            </span>
            <span class="dominance-pct">${pct}%</span>
          </div>
        </td>
        <td><span class="badge ${badgeClass}">${r.focusLabel}</span></td>
      </tr>
    `;
  }).join("");
}

function focusOrder(label) {
  switch (label) {
    case "Highly Focused": return 0;
    case "Focused": return 1;
    case "Mixed": return 2;
    default: return 3;
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────

function bindEvents(playlistStats, playlistMeta) {
  $("#table-search").addEventListener("input", (e) => {
    currentSearch = e.target.value;
    renderTable(playlistStats, playlistMeta);
  });

  $("#table-sort").addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderTable(playlistStats, playlistMeta);
  });

  $("#btn-refresh").addEventListener("click", async () => {
    const btn = $("#btn-refresh");
    btn.disabled = true;
    btn.textContent = "Syncing…";

    try {
      const resp = await chrome.runtime.sendMessage({ type: "SYNC_START" });
      if (resp.success) {
        window.location.reload();
      } else {
        alert("Sync failed: " + (resp.error || "Unknown error"));
      }
    } catch (err) {
      alert("Sync error: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "🔄 Refresh";
    }
  });
}

// ─── Last Sync ───────────────────────────────────────────────────────────────

function renderLastSync(ts) {
  if (!ts) return;
  const d = new Date(ts);
  $("#dash-last-sync").textContent =
    `Last sync: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function showEmptyState() {
  $(".dashboard").innerHTML = `
    <div class="empty-state">
      <h2>No Data Yet</h2>
      <p>Open the extension popup and sign in to sync your playlists.</p>
    </div>
  `;
}

// ─── Util ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
