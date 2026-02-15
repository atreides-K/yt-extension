/**
 * Dashboard Pinia Store.
 *
 * Single source of truth for the dashboard UI.
 * Loads data from IndexedDB (fast local cache), then reconciles
 * with chrome.storage.local to pick up any fresher sync results
 * written by the background service worker.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dbGet, dbSet } from '../db'
import {
  mockGlobalStats,
  mockPlaylistStats,
  mockPlaylistMeta,
  mockPlaylistCategories,
  mockLastSync,
} from '../dev/mock-data'

const isDev = !(
  typeof chrome !== 'undefined' &&
  chrome.storage?.local &&
  chrome.runtime?.sendMessage
)

export const useDashboardStore = defineStore('dashboard', () => {
  // ─── State ─────────────────────────────────────────────────────────────────

  const globalStats = ref(null)
  const playlistStats = ref({})
  const playlistMeta = ref({})
  const playlistCategories = ref({})
  const lastSync = ref(null)

  const isLoading = ref(true)
  const isSyncing = ref(false)
  const syncError = ref(null)

  const searchQuery = ref('')
  const sortBy = ref('ratio')
  const filterCategory = ref('')
  const selectedPlaylistId = ref(null)

  // ─── Computed ──────────────────────────────────────────────────────────────

  const totalPlaylists = computed(() => globalStats.value?.totalPlaylists ?? 0)
  const totalVideos = computed(() => globalStats.value?.totalVideos ?? 0)

  const categoryDistribution = computed(
    () => globalStats.value?.categoryDistribution ?? {},
  )

  const uniqueCategories = computed(
    () => Object.keys(categoryDistribution.value).length,
  )

  const topCategory = computed(() => {
    const entries = Object.entries(categoryDistribution.value)
    if (!entries.length) return '—'
    entries.sort((a, b) => b[1] - a[1])
    return entries[0][0]
  })

  // All category labels that appear in ANY playlist (for the filter dropdown)
  const allCategories = computed(() => {
    const cats = new Set()
    for (const stats of Object.values(playlistStats.value)) {
      if (stats.categoryFrequency) {
        for (const label of Object.keys(stats.categoryFrequency)) {
          cats.add(label)
        }
      }
    }
    return Array.from(cats).sort()
  })

  const playlistRows = computed(() => {
    let rows = Object.entries(playlistStats.value).map(([pid, stats]) => ({
      id: pid,
      name: playlistMeta.value[pid]?.title || pid,
      url: playlistMeta.value[pid]?.url || `https://www.youtube.com/playlist?list=${pid}`,
      totalVideos: stats.totalVideos,
      dominantCategory: stats.dominantCategory || '—',
      dominantRatio: stats.dominantRatio || 0,
      focusLabel: stats.focusLabel || 'Empty',
      createdAt: playlistMeta.value[pid]?.publishedAt || null,
      // all categories in this playlist (for filtering)
      categories: stats.categoryFrequency ? Object.keys(stats.categoryFrequency) : [],
    }))

    // Category filter — show playlist if it contains ANY video with this category
    if (filterCategory.value) {
      const cat = filterCategory.value
      rows = rows.filter((r) => r.categories.includes(cat))
    }

    // Search filter
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.dominantCategory.toLowerCase().includes(q),
      )
    }

    // Sort
    switch (sortBy.value) {
      case 'name':
        rows.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'videos':
        rows.sort((a, b) => b.totalVideos - a.totalVideos)
        break
      case 'ratio':
        rows.sort((a, b) => b.dominantRatio - a.dominantRatio)
        break
      case 'focus':
        rows.sort((a, b) => focusOrder(a.focusLabel) - focusOrder(b.focusLabel))
        break
      case 'newest':
        rows.sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return db - da
        })
        break
      case 'oldest':
        rows.sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : Infinity
          const db = b.createdAt ? new Date(b.createdAt).getTime() : Infinity
          return da - db
        })
        break
    }

    return rows
  })

  // ─── Selected Playlist Detail ──────────────────────────────────────────────

  const selectedPlaylist = computed(() => {
    const pid = selectedPlaylistId.value
    if (!pid) return null
    const meta = playlistMeta.value[pid] || {}
    const stats = playlistStats.value[pid] || {}
    return {
      id: pid,
      title: meta.title || pid,
      description: meta.description || '',
      url: meta.url || `https://www.youtube.com/playlist?list=${pid}`,
      thumbnail: meta.thumbnail || '',
      privacyStatus: meta.privacyStatus || 'unknown',
      ...stats,
    }
  })

  const selectedVideos = computed(() => {
    const pid = selectedPlaylistId.value
    if (!pid) return []
    const cats = playlistCategories.value[pid] || {}
    return Object.entries(cats).map(([videoId, info]) => ({
      id: videoId,
      title: info.title || videoId,
      category: info.category || 'Unknown',
      categoryId: info.categoryId || null,
      channelTitle: info.channelTitle || '',
      thumbnail: info.thumbnail || '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    }))
  })

  function selectPlaylist(pid) {
    selectedPlaylistId.value = pid
  }

  function clearSelection() {
    selectedPlaylistId.value = null
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  /**
   * Load dashboard data.
   * 1. Read IndexedDB (instant local cache).
   * 2. Check chrome.storage.local for a newer sync timestamp.
   * 3. If chrome side is fresher, overwrite IndexedDB cache.
   */
  async function loadData() {
    isLoading.value = true
    try {
      // Dev mode: use mock data so the UI is populated on localhost
      if (isDev) {
        console.info('[Dashboard] Dev mode — loading mock data')
        globalStats.value = mockGlobalStats
        playlistStats.value = mockPlaylistStats
        playlistMeta.value = mockPlaylistMeta
        playlistCategories.value = mockPlaylistCategories
        lastSync.value = mockLastSync
        return
      }

      // 1 — IndexedDB (may be null on first run)
      let gs = await dbGet('globalStats')
      let ps = await dbGet('playlistStats')
      let pm = await dbGet('playlistMeta')
      let pc = await dbGet('playlistCategories')
      let ls = await dbGet('lastSync')

      // 2 — chrome.storage.local (written by background.js after sync)
      const chromeData = await chrome.storage.local.get([
        'globalStats',
        'playlistStats',
        'playlistMeta',
        'playlistCategories',
        'lastSync',
      ])

      const chromeSyncTime = chromeData.lastSync || 0
      const idbSyncTime = ls || 0

      if (chromeSyncTime > idbSyncTime && chromeData.globalStats) {
        gs = chromeData.globalStats
        ps = chromeData.playlistStats
        pm = chromeData.playlistMeta
        pc = chromeData.playlistCategories
        ls = chromeData.lastSync

        // 3 — Persist fresher data to IndexedDB
        await Promise.all([
          dbSet('globalStats', gs),
          dbSet('playlistStats', ps),
          dbSet('playlistMeta', pm),
          dbSet('playlistCategories', pc),
          dbSet('lastSync', ls),
        ])
      }

      globalStats.value = gs || null
      playlistStats.value = ps || {}
      playlistMeta.value = pm || {}
      playlistCategories.value = pc || {}
      lastSync.value = ls || null
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Trigger a full re-sync via the background service worker,
   * then reload the dashboard data.
   */
  async function refresh() {
    if (isDev) {
      // In dev mode just simulate a quick reload of mock data
      isSyncing.value = true
      await new Promise((r) => setTimeout(r, 600))
      lastSync.value = Date.now()
      isSyncing.value = false
      return
    }

    isSyncing.value = true
    syncError.value = null
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'SYNC_START' })
      if (resp.success) {
        await loadData()
      } else {
        syncError.value = resp.error || 'Sync failed'
      }
    } catch (err) {
      syncError.value = err.message
    } finally {
      isSyncing.value = false
    }
  }

  // ─── Expose ────────────────────────────────────────────────────────────────

  return {
    // state
    globalStats,
    playlistStats,
    playlistMeta,
    playlistCategories,
    lastSync,
    isLoading,
    isSyncing,
    syncError,
    searchQuery,
    sortBy,
    filterCategory,
    selectedPlaylistId,
    // computed
    totalPlaylists,
    totalVideos,
    categoryDistribution,
    uniqueCategories,
    topCategory,
    allCategories,
    playlistRows,
    selectedPlaylist,
    selectedVideos,
    // actions
    loadData,
    refresh,
    selectPlaylist,
    clearSelection,
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function focusOrder(label) {
  switch (label) {
    case 'Highly Focused':
      return 0
    case 'Focused':
      return 1
    case 'Mixed':
      return 2
    default:
      return 3
  }
}
