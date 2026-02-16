# Playlist Intelligence — Chrome Extension (MVP v0.2)

Category-based playlist ordering, collection insights, and in-modal search for YouTube.  
Reorders "Save to playlist" suggestions by matching the video's category to each playlist's dominant content type — and adds a quick-search filter that works even without an API key.

---

## Quick Start

1. Go to `chrome://extensions` in Chrome/Chromium.
2. Enable **Developer mode** (toggle in top-right).
3. Click **Load unpacked** → select the project folder.
4. Click the extension icon → enter your **OAuth Client ID** (see setup below).
5. Hit **Save & Sync** — Chrome will ask you to sign in with Google, then the extension fetches all your playlists (including private), categorises every video, and computes stats.
6. Open any YouTube video → click **Save** → playlists are now reordered by relevance with a search bar at the top.
7. Click **View Dashboard** in the popup for full analytics.

> **No API key?** The search bar in the save modal still works — you can filter playlists by name without any configuration.

### Setting Up OAuth (recommended — includes private playlists)

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or use an existing one).
3. Enable the **YouTube Data API v3** (APIs & Services → Library → search "YouTube Data API v3" → Enable).
4. Configure the **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: **External**
   - Fill in the required fields (app name, email)
   - Add scope: `youtube.readonly`
   - Add your Google account as a **test user**
5. Go to **Credentials** → **Create Credentials** → **OAuth client ID**.
6. Application type: **Web application** (not "Chrome Extension").
7. Under **Authorized redirect URIs**, add the URI shown in the extension popup (it looks like `https://abcdef1234.chromiumapp.org/`).
8. Click **Create**, copy the **Client ID**, and paste it into the extension popup.

> **Why "Web application"?** The extension uses `chrome.identity.launchWebAuthFlow()` which requires a web-type credential with a custom redirect URI. The "Chrome Extension" type uses a different auth mechanism.

> **Why do I need my own project?** Each user's API calls count against their own project's 10,000 units/day free quota — this keeps the extension free for everyone.

### Alternative: API Key + Channel ID (public playlists only)

If you only want to analyze public playlists and don't need OAuth:

1. In the same Google Cloud project, go to **Credentials** → **Create Credentials** → **API Key**.
2. Copy the key and paste it into the extension popup (expand "Alternative" section).
3. Enter your **Channel ID** (see below).

### Finding Your Channel ID

1. Go to your YouTube channel page.
2. Click your profile icon → **Your channel**.
3. The URL will be `youtube.com/channel/UCxxxxxx…` — copy the `UC…` part.
4. Alternatively, use [this tool](https://commentpicker.com/youtube-channel-id.php).

---

## Project Structure

```
yt-extension/
├── manifest.json              # Chrome Extension manifest (MV3)
├── background.js              # Service worker — message router & sync orchestrator
│
├── lib/                       # Core logic (pure JS modules, no DOM)
│   ├── youtube-api.js         # YouTube Data API v3 wrapper + quota tracking
│   ├── playlist-stats.js      # Per-playlist & global stats computation
│   ├── save-reorder.js        # Playlist scoring & ranking engine
│   └── category-map.js        # Static categoryId → label lookup
│
├── popup/                     # Extension popup (click the toolbar icon)
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
│
├── dashboard/                 # Built Vue 3 dashboard (output from dashboard-vue/)
│   └── index.html
│
├── dashboard-vue/             # Dashboard source (Vue 3 + Pinia + Vite)
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── stores/dashboard.js    # Pinia store — state, computed, actions
│   │   ├── db/index.js            # IndexedDB wrapper (idb library)
│   │   ├── dev/mock-data.js       # Mock data for localhost dev mode
│   │   └── components/
│   │       ├── DashHeader.vue
│   │       ├── SummaryCards.vue
│   │       ├── CategoryChart.vue
│   │       ├── PlaylistTable.vue
│   │       ├── PlaylistDetail.vue
│   │       ├── DashFooter.vue
│   │       └── EmptyState.vue
│   ├── package.json
│   └── vite.config.js
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
┌──────────────┐   SYNC_START / GET_API_USAGE  ┌──────────────────┐
│  popup.js    │ ──────────────────────────────▶│  background.js   │
│  (popup UI)  │ ◀──────────────────────────── │  (service worker) │
│              │      SYNC_PROGRESS            │                  │
└──────────────┘                               │  ┌─────────────┐ │
                                               │  │ youtube-api │ │──▶ YouTube API v3
┌──────────────┐   GET_REORDERED_PLAYLISTS     │  │ playlist-   │ │    (with quota tracking)
│ content.js   │ ──────────────────────────────▶│  │   stats     │ │
│ (YouTube     │ ◀──────────────────────────── │  │ save-reorder│ │
│  save modal) │   ranked playlist list        │  └─────────────┘ │
└──────────────┘                               └────────┬─────────┘
  + search bar (no API needed)                          │
                                               ┌───────┴─────────┐
┌──────────────┐                               │ chrome.storage   │
│ dashboard    │ ◀── IndexedDB + chrome ───────│  .local          │
│ (Vue 3 app)  │     storage.local             │                  │
└──────────────┘                               └─────────────────┘
```

All data lives in **`chrome.storage.local`** + **IndexedDB** (dashboard cache) — no cloud backend.

---

## Features

### Save Modal Enhancements
- **Playlist reordering** — playlists sorted by category match score when saving a video.
- **Search bar** — auto-focused search input injected into the "Save to…" modal to filter playlists by name. **Works without API key** — useful even without any configuration.
- **Visual indicators** — ★ gold star for best matches, ● blue dot for partial matches, category banner.

### Analytics Dashboard (Vue 3)
- **Summary cards** — total playlists, videos, unique categories, top category.
- **Donut chart** — interactive global category distribution with hover highlighting.
- **Playlist table** — searchable, sortable (name / videos / dominance / focus / newest / oldest), with:
  - Row index numbers
  - Category filter (any-match — shows playlist if it contains *any* video of that category, not just dominant)
  - Creation date column
  - Action buttons (open on YouTube, view details)
- **Playlist detail panel** — slide-over with thumbnail, description, stats strip, category breakdown bars, and scrollable video list with search.

### API Quota Management
- **Daily call counter** — every YouTube API call is tracked in `chrome.storage.local`, auto-resets at midnight.
- **Usage display** — color-coded progress bar in the popup (green → orange → red) showing `N / 10,000`.
- **Safety guard** — sync is automatically blocked at 9,500 calls (95%) to prevent billing. Warning shown at 75%.

### Delta Sync
- **Incremental updates** — on subsequent syncs, only fetches `videos.list` for newly added videos. Cached video data is reused, reducing API calls by up to 95%.

---

## File-by-File Breakdown

### `manifest.json`

MV3 manifest. Key settings:

| Field | Value |
|---|---|
| Permissions | `storage`, `activeTab`, `identity` |
| Host permissions | `googleapis.com`, `youtube.com` |
| Content script | Runs on `youtube.com` at `document_idle` |

### `background.js` — Service Worker

Central message router. Handles these message types:

| Message | Direction | What it does |
|---|---|---|
| `SYNC_START` | popup/dashboard → bg | Runs the full sync pipeline (delta-aware) |
| `GET_REORDERED_PLAYLISTS` | content → bg | Scores & ranks playlists for a video |
| `GET_API_USAGE` | popup → bg | Returns today's API call count |
| `RESET_API_USAGE` | popup → bg | Resets the daily counter |
| `CLEAR_DATA` | popup → bg | Removes all stored data |

Emits `SYNC_PROGRESS` messages back to the popup during sync.

### `lib/youtube-api.js` — API Wrapper

Key functions:

| Function | Purpose |
|---|---|
| `getChannelPlaylists(channelId)` | Fetch public playlists by channel ID (API key only) |
| `getUserPlaylists(apiKey, oauthToken)` | Fetch all playlists including private (OAuth) |
| `getAuthToken(interactive)` | Get OAuth2 token via `launchWebAuthFlow` using user's client ID |
| `removeAuthToken()` | Revoke and clear cached OAuth token |
| `getPlaylistVideoIds(playlistId)` | Fetch all video IDs in a playlist (paginated) |
| `getVideoCategoryIds(videoIds)` | Batch video→category lookup (50 per call), returns `{ categoryId, title, channelTitle, thumbnail }` |
| `getPlaylistVideoCategories(playlistId)` | Full pipeline: get video IDs → get categories |
| `getPlaylistVideoCategoriesDelta(playlistId, apiKey, cache)` | Delta-aware version — only fetches new videos |
| `getVideoCategory(videoId)` | Single video category lookup |
| `getApiUsage()` | Read today's API call count |
| `resetApiUsage()` | Reset the daily counter |
| `extractVideoId(input)` | Parse URL/ID (watch, youtu.be, shorts) |

Every call through `apiCall()` increments a daily counter and checks against the 10,000 quota limit.

### `lib/playlist-stats.js` — Stats Engine

| Function | Returns |
|---|---|
| `computePlaylistStats(videoCategories)` | `{ totalVideos, categoryFrequency, dominantCategory, dominantCategoryId, dominantCount, dominantRatio, uniqueCategories, focusLabel }` |
| `computeGlobalStats(allPlaylistStats)` | `{ totalPlaylists, totalVideos, categoryDistribution }` |
| `getCategoryDistribution(videoCategories)` | `{ categoryId: ratio }` — normalized distribution used by the reorder engine |

Focus labels: **Highly Focused** (≥80%), **Focused** (≥50%), **Mixed** (<50%).

### `lib/save-reorder.js` — Scoring Engine

Scoring formula:

```
category_match_score = playlist_category_ratio[video_category]
dominant_bonus       = 1 if playlist.dominant == video_category else 0
final_score          = dominant_bonus + category_match_score
```

Playlists are sorted by `final_score` descending, then alphabetically on ties.

### `lib/category-map.js` — Category Lookup

Static map of YouTube's 30+ category IDs to labels (`"10" → "Music"`, `"20" → "Gaming"`, etc.). Avoids runtime API calls for category names.

### `popup/` — Extension Popup

- **Auth section**: OAuth Client ID input (primary) with redirect URI display, plus expandable API Key + Channel ID (alternative).
- **Status bar**: Spinner + progress bar during sync.
- **Quick stats**: 3 cards (playlists / videos / categories) + top-5 category bars.
- **API usage**: Color-coded daily quota bar with warning/blocking at high usage.
- **Actions**: Sync button, Dashboard button.

### `content/` — YouTube Page Injection

Runs inside YouTube pages. Uses a `MutationObserver` to detect when the "Save to playlist" modal opens, then:

1. **Injects a search bar** (auto-focused) at the top of the playlist list for instant filtering by name — works without any API key.
2. Extracts the current video ID from the URL.
3. Sends `GET_REORDERED_PLAYLISTS` to the background worker.
4. Reorders the playlist DOM elements in-place.
5. Adds visual indicators: ★ (gold) for best matches, ● (blue) for partial matches.
6. Shows a category banner above the playlist list.

Handles YouTube's SPA navigation via the `yt-navigate-finish` event.

### `dashboard-vue/` — Analytics Dashboard (Vue 3 + Pinia)

Built with Vite, outputs to `dashboard/`. Uses IndexedDB (`idb` library) as a fast local cache, reconciling with `chrome.storage.local` for fresh sync data.

| Component | Content |
|---|---|
| `SummaryCards` | Total playlists, videos, categories, top category |
| `CategoryChart` | Interactive donut chart with hover-highlighting legend |
| `PlaylistTable` | Indexed rows, category filter (any-match), 6 sort options, search, action buttons |
| `PlaylistDetail` | Slide-over panel with playlist info, category breakdown, scrollable video list |
| `EmptyState` | "No Data Yet" prompt for first-time users |

Dev mode (`npm run dev`) loads mock data so the UI is fully functional on localhost without Chrome APIs.

---

## Storage Schema

All data is persisted in `chrome.storage.local`:

| Key | Type | Description |
|---|---|---|
| `oauthClientId` | `string` | User's OAuth Client ID (from their Google Cloud project) |
| `oauthToken` | `string` | Cached OAuth access token |
| `oauthTokenExpiry` | `number` | Token expiry timestamp (ms) |
| `apiKey` | `string` | User's YouTube Data API key (alternative auth) |
| `channelId` | `string` | YouTube channel ID (required with API key only) |
| `globalStats` | `object` | `{ totalPlaylists, totalVideos, categoryDistribution }` |
| `playlistStats` | `object` | `{ [playlistId]: { totalVideos, dominantCategory, categoryFrequency, … } }` |
| `playlistMeta` | `object` | `{ [playlistId]: { title, description, url, thumbnail, publishedAt, privacyStatus, videoCount } }` |
| `playlistCategories` | `object` | `{ [playlistId]: { [videoId]: { categoryId, category, title, channelTitle, thumbnail } } }` |
| `apiUsage` | `object` | `{ date: "YYYY-MM-DD", count: number }` — daily API call counter |
| `lastSync` | `number` | Unix timestamp of last sync |

The Vue dashboard also caches the above in **IndexedDB** (database `playlist-intelligence`) for instant loading.

---

## Sync Pipeline

1. **Authenticate** — if OAuth Client ID is configured, gets a token via `chrome.identity.launchWebAuthFlow()`. Falls back to API key + channel ID.
2. **Fetch playlists** — OAuth: `getUserPlaylists()` (mine=true, includes private). Fallback: `getChannelPlaylists()` (public only).
3. **Per playlist (delta-aware)** — `getPlaylistVideoCategoriesDelta()` compares current video IDs against cache, only fetching `videos.list` for new videos.
4. **Compute stats** — `computePlaylistStats()` per playlist, `computeGlobalStats()` across all.
5. **Track quota** — each API call increments the daily counter; sync is blocked if nearing the 10,000 limit.
6. **Persist** — writes everything to `chrome.storage.local`.
7. **Progress** — emits `SYNC_PROGRESS` messages at each step so the popup can update its progress bar.

---

## Development Notes

- **Dashboard build step** — `cd dashboard-vue && npm run build` compiles the Vue app to `dashboard/`. The rest of the extension is plain ES modules loaded directly.
- **Dev mode** — `cd dashboard-vue && npm run dev` runs the dashboard on localhost with mock data (no Chrome APIs needed).
- **OAuth support** — users supply their own OAuth Client ID from their own Google Cloud project. Each user's API calls use their own quota (10,000 units/day free). Tokens are cached locally and never leave the browser.
- **No developer quota cost** — since each user brings their own credentials, the developer's API usage is zero.
- **Quota safety** — daily API calls are tracked and capped at 9,500/10,000 to prevent accidental billing. The counter resets automatically at midnight.
- **Delta sync** — subsequent syncs reuse cached video data, reducing API calls by up to 95%.
- Replace the placeholder icons in `icons/` with proper assets before publishing.
