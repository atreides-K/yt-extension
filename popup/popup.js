/**
 * Popup Script — Extension popup logic.
 *
 * Handles:
 *  - API key + Channel ID configuration
 *  - Triggering full sync
 *  - Displaying quick stats
 *  - Opening dashboard
 */

// ─── DOM Elements ────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

const elLoggedOut     = $("#logged-out");
const elLoggedIn      = $("#logged-in");
const elUserLabel     = $("#user-label");
const elBtnSaveConfig = $("#btn-save-config");
const elBtnEdit       = $("#btn-edit");
const elInputApiKey   = $("#input-api-key");
const elInputChannel  = $("#input-channel-id");

const elStatusSection = $("#status-section");
const elStatusText    = $("#status-text");
const elProgressFill  = $("#progress-fill");

const elStatsSection  = $("#stats-section");
const elStatPlaylists = $("#stat-playlists");
const elStatVideos    = $("#stat-videos");
const elStatCategories= $("#stat-categories");
const elTopCategories = $("#top-categories");

const elActionsSection= $("#actions-section");
const elBtnSync       = $("#btn-sync");
const elBtnDashboard  = $("#btn-dashboard");

const elFooter        = $("#footer");
const elLastSync      = $("#last-sync");

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  await checkExistingConfig();
  await loadCachedStats();
  bindEvents();
});

// ─── Config ──────────────────────────────────────────────────────────────────

async function checkExistingConfig() {
  try {
    const result = await chrome.storage.local.get(["apiKey", "channelId"]);

    // Always restore input values so they survive popup close/reopen
    if (result.apiKey) elInputApiKey.value = result.apiKey;
    if (result.channelId) elInputChannel.value = result.channelId;

    if (result.apiKey && result.channelId) {
      showConfigured(`Channel: ${result.channelId}`);
    }
  } catch {
    // No stored config
  }
}

async function handleSaveConfig() {
  const apiKey = elInputApiKey.value.trim();
  const channelId = elInputChannel.value.trim();

  if (!apiKey) {
    showError("Please enter your YouTube API key.");
    return;
  }
  if (!channelId) {
    showError("Please enter a Channel ID.");
    return;
  }

  await chrome.storage.local.set({ apiKey, channelId });
  showConfigured(`Channel: ${channelId}`);
  await triggerSync();
}

function handleEdit() {
  showConfigForm();
}

async function handleClear() {
  await chrome.storage.local.remove([
    "apiKey", "channelId",
    "globalStats", "playlistStats", "playlistMeta",
    "playlistCategories", "lastSync"
  ]);
  showConfigForm();
  elStatsSection.classList.add("hidden");
  elActionsSection.classList.add("hidden");
  elFooter.classList.add("hidden");
}

function showConfigured(label) {
  elLoggedOut.classList.add("hidden");
  elLoggedIn.classList.remove("hidden");
  elUserLabel.textContent = label;
  elActionsSection.classList.remove("hidden");
}

function showConfigForm() {
  elLoggedOut.classList.remove("hidden");
  elLoggedIn.classList.add("hidden");
}

// ─── Sync ────────────────────────────────────────────────────────────────────

async function triggerSync() {
  elStatusSection.classList.remove("hidden");
  elStatusText.textContent = "Syncing playlists…";
  elProgressFill.style.width = "10%";

  try {
    // Listen for progress updates
    const progressListener = (msg) => {
      if (msg.type === "SYNC_PROGRESS") {
        elStatusText.textContent = msg.text;
        elProgressFill.style.width = `${msg.percent}%`;
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    const response = await chrome.runtime.sendMessage({ type: "SYNC_START" });

    chrome.runtime.onMessage.removeListener(progressListener);

    if (response.success) {
      elProgressFill.style.width = "100%";
      elStatusText.textContent = "Sync complete!";

      setTimeout(() => {
        elStatusSection.classList.add("hidden");
      }, 1500);

      await loadCachedStats();
    } else {
      showError(response.error || "Sync failed");
    }
  } catch (err) {
    showError(err.message);
  }
}

// ─── Stats Display ───────────────────────────────────────────────────────────

async function loadCachedStats() {
  try {
    const data = await chrome.storage.local.get(["globalStats", "lastSync"]);

    if (!data.globalStats) return;

    const stats = data.globalStats;

    elStatsSection.classList.remove("hidden");
    elStatPlaylists.textContent = stats.totalPlaylists;
    elStatVideos.textContent = stats.totalVideos;
    elStatCategories.textContent = Object.keys(stats.categoryDistribution).length;

    renderTopCategories(stats.categoryDistribution, stats.totalVideos);

    if (data.lastSync) {
      elFooter.classList.remove("hidden");
      const d = new Date(data.lastSync);
      elLastSync.textContent = `Last sync: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    }
  } catch {
    // No cached data
  }
}

function renderTopCategories(distribution, totalVideos) {
  const sorted = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) {
    elTopCategories.innerHTML = "";
    return;
  }

  const maxCount = sorted[0][1];

  let html = `<h3>Top Categories</h3>`;
  for (const [label, count] of sorted) {
    const pct = (count / maxCount) * 100;
    html += `
      <div class="category-row">
        <span class="category-name">${escapeHtml(label)}</span>
        <span class="category-bar-wrap">
          <span class="category-bar" style="width: ${pct}%"></span>
        </span>
        <span class="category-count">${count}</span>
      </div>
    `;
  }

  elTopCategories.innerHTML = html;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/index.html") });
}

// ─── Error ───────────────────────────────────────────────────────────────────

function showError(msg) {
  elStatusSection.classList.remove("hidden");
  elStatusText.textContent = `❌ ${msg}`;
  elProgressFill.style.width = "0%";
}

// ─── Events ──────────────────────────────────────────────────────────────────

function bindEvents() {
  elBtnSaveConfig.addEventListener("click", handleSaveConfig);
  elBtnEdit.addEventListener("click", handleEdit);
  elBtnSync.addEventListener("click", triggerSync);
  elBtnDashboard.addEventListener("click", openDashboard);

  elInputChannel.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSaveConfig();
  });

  // Auto-save inputs on every keystroke so values survive popup close/reopen
  elInputApiKey.addEventListener("input", () => {
    chrome.storage.local.set({ apiKey: elInputApiKey.value.trim() });
  });
  elInputChannel.addEventListener("input", () => {
    chrome.storage.local.set({ channelId: elInputChannel.value.trim() });
  });
}

// ─── Util ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
