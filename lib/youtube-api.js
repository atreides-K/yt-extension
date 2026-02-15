/**
 * YouTube Data API v3 wrapper.
 * Uses a user-provided API key for all requests.
 * Port of yt_utils.py → JavaScript for Chrome Extension context.
 */

import { getCategoryLabel } from "./category-map.js";

const API_BASE = "https://www.googleapis.com/youtube/v3";

// ─── API Key Helper ──────────────────────────────────────────────────────────

/**
 * Retrieve the user's stored API key from chrome.storage.local.
 * @returns {Promise<string>}
 */
export async function getStoredApiKey() {
  const data = await chrome.storage.local.get(["apiKey"]);
  return data.apiKey || null;
}

// ─── API Call Helper ─────────────────────────────────────────────────────────

/**
 * Make a request to YouTube Data API using the provided API key.
 * @param {string} endpoint - e.g. "playlists"
 * @param {Object} params   - query parameters
 * @param {string} apiKey   - YouTube Data API key
 * @returns {Promise<Object>}
 */
async function apiCall(endpoint, params = {}, apiKey) {
  if (!apiKey) {
    throw new Error("No API key provided. Enter your YouTube API key in the extension popup.");
  }

  const url = new URL(`${API_BASE}/${endpoint}`);
  params.key = apiKey;

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  }

  const resp = await fetch(url.toString());

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`YouTube API ${resp.status}: ${body}`);
  }

  return resp.json();
}

// ─── Playlist Retrieval ──────────────────────────────────────────────────────

/**
 * Fetch all PUBLIC playlists for a given channel ID.
 * @param {string} channelId
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<Array>}
 */
export async function getChannelPlaylists(channelId, apiKey) {
  const all = [];
  let pageToken = null;

  do {
    const resp = await apiCall("playlists", {
      part: "snippet,contentDetails",
      channelId,
      maxResults: 50,
      pageToken
    }, apiKey);

    all.push(...(resp.items || []));
    pageToken = resp.nextPageToken || null;
  } while (pageToken);

  return all;
}

// ─── Video Retrieval ─────────────────────────────────────────────────────────

/**
 * Fetch ALL video IDs in a playlist.
 * @param {string} playlistId
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<string[]>} array of video IDs
 */
export async function getPlaylistVideoIds(playlistId, apiKey) {
  const ids = [];
  let pageToken = null;

  do {
    const resp = await apiCall("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: 50,
      pageToken
    }, apiKey);

    for (const item of (resp.items || [])) {
      const vid = item.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }

    pageToken = resp.nextPageToken || null;
  } while (pageToken);

  return ids;
}

/**
 * Fetch category IDs for a batch of video IDs (max 50 per call).
 * Returns map: videoId → categoryId
 * @param {string[]} videoIds - up to 50 IDs
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<Object>} { videoId: categoryId }
 */
export async function getVideoCategoryIds(videoIds, apiKey) {
  if (!videoIds.length) return {};

  const result = {};

  // Process in batches of 50 (API limit)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const resp = await apiCall("videos", {
      part: "snippet",
      id: batch.join(",")
    }, apiKey);

    for (const item of (resp.items || [])) {
      result[item.id] = {
        categoryId: item.snippet.categoryId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle || "",
        thumbnail: item.snippet.thumbnails?.medium?.url
          || item.snippet.thumbnails?.default?.url || "",
      };
    }
  }

  return result;
}

/**
 * Get category info for a single video.
 * @param {string} videoId
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<{videoId: string, categoryId: string, category: string}|null>}
 */
export async function getVideoCategory(videoId, apiKey) {
  const map = await getVideoCategoryIds([videoId], apiKey);
  const info = map[videoId];
  if (!info) return null;
  return {
    videoId,
    categoryId: info.categoryId,
    category: getCategoryLabel(info.categoryId),
    title: info.title,
    channelTitle: info.channelTitle,
    thumbnail: info.thumbnail,
  };
}

// ─── Full Pipeline ───────────────────────────────────────────────────────────

/**
 * Fetch all video categories for a playlist.
 * Returns: { videoId → { categoryId, category } }
 * @param {string} playlistId
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<Object>}
 */
export async function getPlaylistVideoCategories(playlistId, apiKey) {
  const videoIds = await getPlaylistVideoIds(playlistId, apiKey);
  const detailMap = await getVideoCategoryIds(videoIds, apiKey);

  const result = {};
  for (const vid of videoIds) {
    const info = detailMap[vid];
    result[vid] = {
      categoryId: info?.categoryId || null,
      category: info?.categoryId ? getCategoryLabel(info.categoryId) : "Unknown",
      title: info?.title || "",
      channelTitle: info?.channelTitle || "",
      thumbnail: info?.thumbnail || "",
    };
  }

  return result;
}

/**
 * Delta-aware version of getPlaylistVideoCategories.
 *
 * Compares the current playlist video IDs against a cached map. Only fetches
 * details (videos.list) for videos not already in the cache, dramatically
 * reducing API calls on subsequent syncs.
 *
 * @param {string} playlistId
 * @param {string} apiKey
 * @param {Object} cachedVideos - Previous result from getPlaylistVideoCategories:
 *                                { videoId → { categoryId, category, title, … } }
 * @returns {Promise<{ videos: Object, apiCalls: number }>}
 *   videos  — merged map (cached + newly fetched), pruned of removed videos
 *   apiCalls — number of videos.list batch calls made (0 when fully cached)
 */
export async function getPlaylistVideoCategoriesDelta(playlistId, apiKey, cachedVideos = {}) {
  // Step 1: always fetch current video IDs (playlistItems.list)
  const currentIds = await getPlaylistVideoIds(playlistId, apiKey);
  const currentIdSet = new Set(currentIds);

  // Step 2: determine which IDs are new (not in cache)
  const newIds = currentIds.filter(vid => !cachedVideos[vid]);

  // Step 3: fetch details only for new videos
  let apiCalls = 0;
  let newDetails = {};
  if (newIds.length > 0) {
    apiCalls = Math.ceil(newIds.length / 50);
    newDetails = await getVideoCategoryIds(newIds, apiKey);
  }

  // Step 4: merge — keep cached data for existing videos, add new ones, drop removed
  const result = {};
  for (const vid of currentIds) {
    if (cachedVideos[vid]) {
      // Reuse cached entry
      result[vid] = cachedVideos[vid];
    } else {
      const info = newDetails[vid];
      result[vid] = {
        categoryId: info?.categoryId || null,
        category: info?.categoryId ? getCategoryLabel(info.categoryId) : "Unknown",
        title: info?.title || "",
        channelTitle: info?.channelTitle || "",
        thumbnail: info?.thumbnail || "",
      };
    }
  }

  return { videos: result, apiCalls };
}

// ─── URL Parsing (ported from yt_utils.py) ───────────────────────────────────

/**
 * Extract video ID from URL or raw ID string.
 * Supports: youtube.com/watch, youtu.be, youtube.com/shorts
 * @param {string} input
 * @returns {string|null}
 */
export function extractVideoId(input) {
  if (!input) return null;
  input = input.trim();

  // Raw 11-char ID
  if (input.length === 11 && !input.includes("/")) {
    return input;
  }

  try {
    const url = new URL(input);

    // youtu.be/<id>
    if (url.hostname === "youtu.be" || url.hostname === "www.youtu.be") {
      return url.pathname.slice(1) || null;
    }

    // youtube.com
    if (url.hostname.includes("youtube.com")) {
      // /watch?v=<id>
      const v = url.searchParams.get("v");
      if (v) return v;

      // /shorts/<id>
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || null;
      }
    }
  } catch {
    // Not a valid URL
  }

  return null;
}
