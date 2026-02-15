# Playlist Intelligence — Chrome Extension (MVP v0.1)

Category-based playlist ordering and collection insights for YouTube.  
Reorders "Save to playlist" suggestions by matching the video's category to each playlist's dominant content type.

---

## Quick Start

1. Go to `chrome://extensions` in Chrome/Chromium.
2. Enable **Developer mode** (toggle in top-right).
3. Click **Load unpacked** → select the `proto_genesis/` folder.
4. Click the extension icon → enter your **YouTube Data API key** and **Channel ID**.
5. Hit **Save & Sync** — the extension fetches playlists, categorises every video, and computes stats.
6. Open any YouTube video → click **Save** → playlists are now reordered by relevance.
7. Click **View Dashboard** in the popup for full analytics.

### Getting a YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or use an existing one).
3. Enable the **YouTube Data API v3**.
4. Go to **Credentials** → **Create Credentials** → **API Key**.
5. Copy the key and paste it into the extension popup.

### Finding Your Channel ID

1. Go to your YouTube channel page.
2. Click your profile icon → **Your channel**.
3. The URL will be `youtube.com/channel/UCxxxxxx…` — copy the `UC…` part.
4. Alternatively, use [this tool](https://commentpicker.com/youtube-channel-id.php).

---

## Project Structure

```
proto_genesis/
├── manifest.json              # Chrome Extension manifest (MV3)
├── background.js              # Service worker — message router & sync orchestrator
│
├── lib/                       # Core logic (pure JS modules, no DOM)
│   ├── youtube-api.js         # YouTube Data API v3 wrapper
│   ├── playlist-stats.js      # Per-playlist & global stats computation
│   ├── save-reorder.js        # Playlist scoring & ranking engine
│   └── category-map.js        # Static categoryId → label lookup
│
├── popup/                     # Extension popup (click the toolbar icon)
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
│
├── dashboard/                 # Full-page analytics dashboard
│   ├── dashboard.html
│   ├── dashboard.js
│   └── dashboard.css
│
├── content/                   # Content script injected into youtube.com
│   ├── content.js
│   └── content.css
│
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Architecture & Data Flow

```
┌──────────────┐   AUTH_LOGIN / SYNC_START   ┌──────────────────┐
│  popup.js    │ ──────────────────────────▶ │  background.js   │
│  (popup UI)  │ ◀────────────────────────── │  (service worker) │
│              │      SYNC_PROGRESS          │                  │
└──────────────┘                             │  ┌─────────────┐ │
                                             │  │ youtube-api │ │──▶ YouTube API v3
┌──────────────┐   GET_REORDERED_PLAYLISTS   │  │ playlist-   │ │
│ content.js   │ ──────────────────────────▶ │  │   stats     │ │
│ (YouTube     │ ◀────────────────────────── │  │ save-reorder│ │
│  save modal) │   ranked playlist list      │  └─────────────┘ │
└──────────────┘                             └────────┬─────────┘
                                                      │
┌──────────────┐                                      │
│ dashboard.js │ ◀── reads chrome.storage.local ──────┘
│ (stats page) │
└──────────────┘
```

All data lives in **`chrome.storage.local`** — no cloud backend.

---

## File-by-File Breakdown

### `manifest.json`

MV3 manifest. Key settings:

| Field | Value |
|---|---|
| Permissions | `storage`, `activeTab` |
| Host permissions | `googleapis.com`, `youtube.com` |
| Content script | Runs on `youtube.com` at `document_idle` |

### `background.js` — Service Worker

Central message router. Handles four message types:

| Message | Direction | What it does |
|---|---|---|
| `SYNC_START` | popup/dashboard → bg | Runs the full sync pipeline (below) |
| `GET_REORDERED_PLAYLISTS` | content → bg | Scores & ranks playlists for a video |
| `CLEAR_DATA` | popup → bg | Removes all stored data |

Emits `SYNC_PROGRESS` messages back to the popup during sync.

### `lib/youtube-api.js` — API Wrapper

Ported from the Python `yt_utils.py`. Key functions:

| Function | Purpose |
|---|---|
| `getAuthToken(interactive)` | OAuth via `chrome.identity` |
| `getUserPlaylists(token)` | Fetch all playlists (private + public, paginated) |
| `getChannelPlaylists(channelId)` | Fetch public playlists by channel ID (API key only) |
| `getPlaylistVideoIds(playlistId)` | Fetch all video IDs in a playlist (paginated) |
| `getVideoCategoryIds(videoIds)` | Batch video→category lookup (50 per API call) |
| `getPlaylistVideoCategories(playlistId)` | Full pipeline: get video IDs → get categories |
| `extractVideoId(input)` | Parse URL/ID (watch, youtu.be, shorts) |

Falls back to API key when no OAuth token is provided.

### `lib/playlist-stats.js` — Stats Engine

| Function | Returns |
|---|---|
| `computePlaylistStats(videoCategories)` | `{ totalVideos, categoryFrequency, dominantCategory, dominantCategoryId, dominantCount, dominantRatio, uniqueCategories, focusLabel }` |
| `computeGlobalStats(allPlaylistStats)` | `{ totalPlaylists, totalVideos, categoryDistribution }` |
| `getCategoryDistribution(videoCategories)` | `{ categoryId: ratio }` — normalized distribution used by the reorder engine |

Focus labels: **Highly Focused** (≥80%), **Focused** (≥50%), **Mixed** (<50%).

### `lib/save-reorder.js` — Scoring Engine

Scoring formula (from PRD §6.4):

```
category_match_score = playlist_category_ratio[video_category]
dominant_bonus       = 1 if playlist.dominant == video_category else 0
final_score          = dominant_bonus + category_match_score
```

Playlists are sorted by `final_score` descending, then alphabetically on ties.

### `lib/category-map.js` — Category Lookup

Static map of YouTube's 30+ category IDs to labels (`"10" → "Music"`, `"20" → "Gaming"`, etc.). Avoids runtime API calls for category names.

### `popup/` — Extension Popup

- **Auth section**: YouTube API key (password field) + Channel ID inputs.
- **Status bar**: Spinner + progress bar during sync.
- **Quick stats**: 3 cards (playlists / videos / categories) + top-5 category bars.
- **Actions**: Sync button, Dashboard button.

### `content/` — YouTube Page Injection

Runs inside YouTube pages. Uses a `MutationObserver` to detect when the "Save to playlist" modal opens, then:

1. Extracts the current video ID from the URL.
2. Sends `GET_REORDERED_PLAYLISTS` to the background worker.
3. Reorders the playlist DOM elements in-place.
4. Adds visual indicators: ★ (gold) for best matches, ● (blue) for partial matches.
5. Shows a category banner above the playlist list.

Handles YouTube's SPA navigation via the `yt-navigate-finish` event.

### `dashboard/` — Analytics Dashboard

Opens in a new tab. Reads cached data from `chrome.storage.local`.

| Section | Content |
|---|---|
| Summary cards | Total playlists, videos, categories, top category |
| Donut chart | Global category distribution (pure canvas, no library) |
| Playlist table | Name, video count, dominant category, dominance bar, focus badge. Searchable and sortable (name / videos / dominance / focus). |

---

## Storage Schema

All data is persisted in `chrome.storage.local`:

| Key | Type | Description |
|---|---|---|
| `apiKey` | `string` | User's YouTube Data API key |
| `channelId` | `string` | YouTube channel ID to analyze |
| `globalStats` | `object` | `{ totalPlaylists, totalVideos, categoryDistribution }` |
| `playlistStats` | `object` | `{ [playlistId]: { totalVideos, dominantCategory, … } }` |
| `playlistMeta` | `object` | `{ [playlistId]: { title, privacyStatus, videoCount } }` |
| `playlistCategories` | `object` | `{ [playlistId]: { [videoId]: { categoryId, category } } }` |
| `lastSync` | `number` | Unix timestamp of last sync |

---

## Sync Pipeline

1. **Fetch playlists** — `getUserPlaylists()` (OAuth) or `getChannelPlaylists()` (channel ID).
2. **Per playlist** — `getPlaylistVideoCategories()` fetches all video IDs, then batch-resolves categories.
3. **Compute stats** — `computePlaylistStats()` per playlist, `computeGlobalStats()` across all.
4. **Persist** — writes everything to `chrome.storage.local`.
5. **Progress** — emits `SYNC_PROGRESS` messages at each step so the popup can update its progress bar.

---

## Development Notes

- **No build step** — plain ES modules, load directly as unpacked extension.
- **No external dependencies** — vanilla JS, no React/Vue/Chart.js.
- **No OAuth required** — users supply their own YouTube Data API key. The key is stored locally in `chrome.storage.local` and never leaves the browser.
- **Rate limits** — the sync fetches categories in batches of 50 (YouTube API limit). For 500 playlists with 20 videos each, that's ~10,000 videos ≈ 200 batch calls + 500 playlist-item calls.
- Replace the placeholder icons in `icons/` with proper assets before publishing.
