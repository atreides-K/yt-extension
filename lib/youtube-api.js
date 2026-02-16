/**
 * YouTube Data API v3 wrapper.
 * Supports both API key (public playlists) and OAuth (all playlists including private).
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

// ─── OAuth Helper ────────────────────────────────────────────────────────────

const OAUTH_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

/**
 * Get an OAuth2 token via chrome.identity.launchWebAuthFlow.
 * Uses the user's own client ID stored in chrome.storage.local.
 * @param {boolean} interactive - If true, opens Google sign-in popup
 * @returns {Promise<string|null>} Access token or null
 */
export async function getAuthToken(interactive = false) {
  try {
    // If we have a cached token, return it (unless expired)
    const stored = await chrome.storage.local.get(["oauthToken", "oauthTokenExpiry"]);
    if (stored.oauthToken && stored.oauthTokenExpiry && Date.now() < stored.oauthTokenExpiry) {
      return stored.oauthToken;
    }

    if (!interactive) return null; // don't prompt if non-interactive and no cached token

    const config = await chrome.storage.local.get(["oauthClientId"]);
    const clientId = config.oauthClientId;
    if (!clientId) {
      throw new Error("No OAuth Client ID configured. Enter it in the popup.");
    }

    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", OAUTH_SCOPE);
    authUrl.searchParams.set("prompt", "consent");

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

    if (!responseUrl) return null;

    // Extract access_token from the redirect URL fragment
    const hash = new URL(responseUrl.replace("#", "?")).searchParams;
    const token = hash.get("access_token");
    const expiresIn = parseInt(hash.get("expires_in") || "3600", 10);

    if (token) {
      // Cache the token with expiry
      await chrome.storage.local.set({
        oauthToken: token,
        oauthTokenExpiry: Date.now() + expiresIn * 1000 - 60000 // 1 min buffer
      });
      return token;
    }
    return null;
  } catch (err) {
    console.warn("[API] OAuth getAuthToken failed:", err.message);
    return null;
  }
}

/**
 * Remove the cached OAuth token (sign out).
 * @returns {Promise<void>}
 */
export async function removeAuthToken() {
  try {
    const stored = await chrome.storage.local.get(["oauthToken"]);
    if (stored.oauthToken) {
      // Revoke the token on Google's side
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${stored.oauthToken}`);
    }
    await chrome.storage.local.remove(["oauthToken", "oauthTokenExpiry", "oauthConnected"]);
  } catch (err) {
    console.warn("[API] OAuth removeAuthToken failed:", err.message);
  }
}

// ─── API Usage Tracking ──────────────────────────────────────────────────────

const DAILY_LIMIT = 10000;
const SAFETY_MARGIN = 500; // block when within this many of the limit

/**
 * Get today's date key (YYYY-MM-DD) for daily tracking.
 */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read the current daily API usage counter.
 * @returns {Promise<{ date: string, count: number }>}
 */
export async function getApiUsage() {
  const data = await chrome.storage.local.get(["apiUsage"]);
  const usage = data.apiUsage || { date: todayKey(), count: 0 };
  // Reset if it's a new day
  if (usage.date !== todayKey()) {
    return { date: todayKey(), count: 0 };
  }
  return usage;
}

/**
 * Increment the daily API call counter by `n`.
 */
async function incrementApiUsage(n = 1) {
  const usage = await getApiUsage();
  usage.count += n;
  usage.date = todayKey();
  await chrome.storage.local.set({ apiUsage: usage });
}

/**
 * Reset the daily API usage counter.
 */
export async function resetApiUsage() {
  await chrome.storage.local.set({ apiUsage: { date: todayKey(), count: 0 } });
}

// ─── API Call Helper ─────────────────────────────────────────────────────────

/**
 * Make a request to YouTube Data API.
 * Supports API key auth OR OAuth Bearer token.
 * Tracks and enforces daily quota.
 * @param {string} endpoint - e.g. "playlists"
 * @param {Object} params   - query parameters
 * @param {string} apiKey   - YouTube Data API key (can be null if token provided)
 * @param {string} [token]  - OAuth2 access token (optional, takes priority)
 * @returns {Promise<Object>}
 */
async function apiCall(endpoint, params = {}, apiKey, token) {
  if (!apiKey && !token) {
    throw new Error("No API key or OAuth token provided.");
  }

  // Check daily quota before making the call
  const usage = await getApiUsage();
  if (usage.count >= DAILY_LIMIT - SAFETY_MARGIN) {
    throw new Error(
      `Daily API limit approaching (${usage.count}/${DAILY_LIMIT} calls used today). ` +
      `Sync disabled to avoid charges. Resets at midnight.`
    );
  }

  const url = new URL(`${API_BASE}/${endpoint}`);

  // Use API key in query params (even with OAuth, it helps with quota attribution)
  if (apiKey) {
    params.key = apiKey;
  }

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  }

  const fetchOptions = {};
  if (token) {
    fetchOptions.headers = { Authorization: `Bearer ${token}` };
  }

  const resp = await fetch(url.toString(), fetchOptions);

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`YouTube API ${resp.status}: ${body}`);
  }

  // Track the successful call
  await incrementApiUsage(1);

  return resp.json();
}

// ─── Playlist Retrieval ──────────────────────────────────────────────────────

/**
 * Fetch ALL playlists for the authenticated user (including private & unlisted).
 * Requires OAuth token.
 * @param {string} apiKey  - YouTube Data API key (for quota attribution)
 * @param {string} token   - OAuth2 access token
 * @returns {Promise<Array>}
 */
export async function getUserPlaylists(apiKey, token) {
  const all = [];
  let pageToken = null;

  do {
    const resp = await apiCall("playlists", {
      part: "snippet,contentDetails,status",
      mine: true,
      maxResults: 50,
      pageToken
    }, apiKey, token);

    all.push(...(resp.items || []));
    pageToken = resp.nextPageToken || null;
  } while (pageToken);

  return all;
}

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
export async function getPlaylistVideoIds(playlistId, apiKey, token) {
  const ids = [];
  let pageToken = null;

  do {
    const resp = await apiCall("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: 50,
      pageToken
    }, apiKey, token);

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
export async function getVideoCategoryIds(videoIds, apiKey, token) {
  if (!videoIds.length) return {};

  const result = {};

  // Process in batches of 50 (API limit)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const resp = await apiCall("videos", {
      part: "snippet",
      id: batch.join(",")
    }, apiKey, token);

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
export async function getVideoCategory(videoId, apiKey, token) {
  const map = await getVideoCategoryIds([videoId], apiKey, token);
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
export async function getPlaylistVideoCategories(playlistId, apiKey, token) {
  const videoIds = await getPlaylistVideoIds(playlistId, apiKey, token);
  const detailMap = await getVideoCategoryIds(videoIds, apiKey, token);

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
export async function getPlaylistVideoCategoriesDelta(playlistId, apiKey, cachedVideos = {}, token) {
  // Step 1: always fetch current video IDs (playlistItems.list)
  const currentIds = await getPlaylistVideoIds(playlistId, apiKey, token);
  const currentIdSet = new Set(currentIds);

  // Step 2: determine which IDs are new (not in cache)
  const newIds = currentIds.filter(vid => !cachedVideos[vid]);

  // Step 3: fetch details only for new videos
  let apiCalls = 0;
  let newDetails = {};
  if (newIds.length > 0) {
    apiCalls = Math.ceil(newIds.length / 50);
    newDetails = await getVideoCategoryIds(newIds, apiKey, token);
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
