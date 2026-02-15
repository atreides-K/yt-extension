/**
 * Background Service Worker — Playlist Intelligence Extension.
 *
 * Handles:
 *  - Full playlist sync pipeline (API key + Channel ID)
 *  - Save-reordering requests from content script
 *  - Progress reporting to popup
 *  - Config clear
 *
 * Uses ES module imports for lib/ code.
 */

import { getStoredApiKey, getChannelPlaylists, getPlaylistVideoCategories, getPlaylistVideoCategoriesDelta, getVideoCategory } from "./lib/youtube-api.js";
import { computePlaylistStats, computeGlobalStats, getCategoryDistribution } from "./lib/playlist-stats.js";
import { reorderPlaylists } from "./lib/save-reorder.js";

// ─── Message Router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch((err) => {
    console.error("[BG] Error handling message:", err);
    sendResponse({ success: false, error: err.message });
  });

  // Return true to indicate async response
  return true;
});

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case "SYNC_START":
      return await handleSync();

    case "GET_REORDERED_PLAYLISTS":
      return await handleReorder(msg.videoId);

    case "CLEAR_DATA":
      return await handleClearData();

    default:
      return { success: false, error: `Unknown message type: ${msg.type}` };
  }
}

// ─── Clear Data ──────────────────────────────────────────────────────────────

async function handleClearData() {
  try {
    await chrome.storage.local.remove([
      "apiKey", "channelId",
      "globalStats", "playlistStats", "playlistMeta",
      "playlistCategories", "lastSync"
    ]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Sync Pipeline ───────────────────────────────────────────────────────────

async function handleSync() {
  try {
    const config = await chrome.storage.local.get(["apiKey", "channelId"]);
    const apiKey = config.apiKey;
    const channelId = config.channelId;

    if (!apiKey) {
      return { success: false, error: "No API key. Enter your YouTube API key in the popup." };
    }
    if (!channelId) {
      return { success: false, error: "No Channel ID. Enter a Channel ID in the popup." };
    }

    // Step 1: Fetch playlists
    sendProgress("Fetching playlists…", 5);

    const playlists = await getChannelPlaylists(channelId, apiKey);

    if (!playlists.length) {
      return { success: false, error: "No playlists found." };
    }

    sendProgress(`Found ${playlists.length} playlists`, 15);

    // Load cached categories for delta sync
    const cached = await chrome.storage.local.get(["playlistCategories"]);
    const cachedCategories = cached.playlistCategories || {};

    // Step 2: Fetch video categories per playlist (delta-aware)
    const playlistStatsMap = {};
    const playlistMetaMap = {};
    const playlistCategoriesMap = {};
    let totalApiCalls = 0;     // videos.list calls actually made
    let totalSkipped = 0;      // videos resolved from cache

    for (let i = 0; i < playlists.length; i++) {
      const pl = playlists[i];
      const pid = pl.id;
      const title = pl.snippet.title;
      const pct = 15 + Math.round((i / playlists.length) * 70);

      sendProgress(`Analyzing: ${title} (${i + 1}/${playlists.length})`, pct);

      // Store metadata
      playlistMetaMap[pid] = {
        title,
        description: pl.snippet.description || "",
        url: `https://www.youtube.com/playlist?list=${pid}`,
        thumbnail: pl.snippet.thumbnails?.medium?.url
          || pl.snippet.thumbnails?.default?.url || "",
        publishedAt: pl.snippet.publishedAt || null,
        privacyStatus: pl.status?.privacyStatus || pl.snippet?.privacyStatus || "unknown",
        videoCount: pl.contentDetails?.itemCount || 0
      };

      // Fetch categories — delta: only new videos hit the API
      try {
        const prevCache = cachedCategories[pid] || {};
        const { videos: videoCategories, apiCalls } = await getPlaylistVideoCategoriesDelta(pid, apiKey, prevCache);

        playlistCategoriesMap[pid] = videoCategories;
        totalApiCalls += apiCalls;

        const cachedCount = Object.keys(videoCategories).length - (apiCalls > 0 ? (apiCalls * 50) : 0);
        totalSkipped += Math.max(0, Object.keys(prevCache).length);

        // Compute stats
        const stats = computePlaylistStats(videoCategories);
        playlistStatsMap[pid] = stats;
      } catch (err) {
        console.warn(`[BG] Failed to analyze playlist ${title}:`, err);
        playlistStatsMap[pid] = computePlaylistStats({});
      }
    }

    // Step 3: Compute global stats
    sendProgress("Computing global statistics…", 90);
    const globalStats = computeGlobalStats(playlistStatsMap);

    console.log(`[BG] Delta sync: ${totalApiCalls} videos.list calls (cached videos reused across ${playlists.length} playlists)`);

    // Step 4: Persist to chrome.storage.local
    sendProgress("Saving data…", 95);
    await chrome.storage.local.set({
      globalStats,
      playlistStats: playlistStatsMap,
      playlistMeta: playlistMetaMap,
      playlistCategories: playlistCategoriesMap,
      lastSync: Date.now()
    });

    sendProgress("Sync complete!", 100);

    return { success: true, totalPlaylists: playlists.length };
  } catch (err) {
    console.error("[BG] Sync failed:", err);
    return { success: false, error: err.message };
  }
}

// ─── Reorder Handler ─────────────────────────────────────────────────────────

async function handleReorder(videoId) {
  try {
    if (!videoId) {
      return { success: false, error: "No video ID provided" };
    }

    // Get the video's category
    const data = await chrome.storage.local.get(["apiKey"]);
    const apiKey = data.apiKey;
    if (!apiKey) {
      return { success: false, error: "No API key configured." };
    }

    const catInfo = await getVideoCategory(videoId, apiKey);
    if (!catInfo) {
      return { success: false, error: "Could not determine video category" };
    }

    // Load stored playlist data
    const stored = await chrome.storage.local.get([
      "playlistStats", "playlistMeta", "playlistCategories"
    ]);

    if (!stored.playlistStats) {
      return { success: false, error: "No playlist data. Sync first." };
    }

    // Build playlistData for reorder engine
    const playlistData = {};
    for (const [pid, stats] of Object.entries(stored.playlistStats)) {
      const cats = stored.playlistCategories?.[pid] || {};
      playlistData[pid] = {
        title: stored.playlistMeta?.[pid]?.title || pid,
        stats,
        categoryDistribution: getCategoryDistribution(cats)
      };
    }

    // Score and reorder
    const reordered = reorderPlaylists(catInfo.categoryId, playlistData);

    return {
      success: true,
      videoCategory: catInfo.category,
      videoCategoryId: catInfo.categoryId,
      reordered
    };
  } catch (err) {
    console.error("[BG] Reorder failed:", err);
    return { success: false, error: err.message };
  }
}

// ─── Progress Reporting ──────────────────────────────────────────────────────

function sendProgress(text, percent) {
  chrome.runtime.sendMessage({
    type: "SYNC_PROGRESS",
    text,
    percent
  }).catch(() => {
    // Popup may not be open — ignore
  });
}
