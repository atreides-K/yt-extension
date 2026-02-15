<template>
  <Transition name="slide">
    <div v-if="store.selectedPlaylist" class="detail-overlay" @click.self="store.clearSelection()">
      <aside class="detail-panel">
        <!-- Header -->
        <div class="detail-header">
          <button class="btn-back" @click="store.clearSelection()">← Back</button>
          <a
            :href="store.selectedPlaylist.url"
            target="_blank"
            rel="noopener"
            class="btn btn-primary btn-sm"
          >
            ▶ Open on YouTube
          </a>
        </div>

        <!-- Playlist Info -->
        <div class="detail-info">
          <img
            v-if="store.selectedPlaylist.thumbnail"
            :src="store.selectedPlaylist.thumbnail"
            :alt="store.selectedPlaylist.title"
            class="detail-thumb"
          />
          <div class="detail-meta">
            <h2>{{ store.selectedPlaylist.title }}</h2>
            <p v-if="store.selectedPlaylist.description" class="detail-desc">
              {{ store.selectedPlaylist.description }}
            </p>
            <div class="detail-badges">
              <span class="meta-chip">{{ store.selectedPlaylist.totalVideos }} videos</span>
              <span class="meta-chip">{{ store.selectedPlaylist.uniqueCategories }} categories</span>
              <span :class="['meta-chip', privacyClass]">
                {{ store.selectedPlaylist.privacyStatus }}
              </span>
            </div>
          </div>
        </div>

        <!-- Stats Strip -->
        <div class="stats-strip">
          <div class="stat-item">
            <span class="stat-val">{{ store.selectedPlaylist.dominantCategory }}</span>
            <span class="stat-lbl">Dominant</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ dominancePct }}%</span>
            <span class="stat-lbl">Dominance</span>
          </div>
          <div class="stat-item">
            <span :class="['badge', badgeClass]">{{ store.selectedPlaylist.focusLabel }}</span>
            <span class="stat-lbl">Focus</span>
          </div>
        </div>

        <!-- Category Breakdown -->
        <div v-if="categoryBreakdown.length" class="category-breakdown">
          <h3>Category Breakdown</h3>
          <div
            v-for="cat in categoryBreakdown"
            :key="cat.label"
            class="cat-row"
          >
            <span class="cat-label">{{ cat.label }}</span>
            <span class="cat-bar-wrap">
              <span
                class="cat-bar"
                :style="{ width: cat.pct + '%' }"
              ></span>
            </span>
            <span class="cat-count">{{ cat.count }}</span>
          </div>
        </div>

        <!-- Video List -->
        <div class="video-list">
          <h3>Videos ({{ store.selectedVideos.length }})</h3>
          <input
            v-model="videoSearch"
            type="text"
            placeholder="Filter videos…"
            class="video-search"
          />
          <div class="video-grid">
            <a
              v-for="video in filteredVideos"
              :key="video.id"
              :href="video.url"
              target="_blank"
              rel="noopener"
              class="video-card"
            >
              <img
                v-if="video.thumbnail"
                :src="video.thumbnail"
                :alt="video.title"
                class="video-thumb"
                loading="lazy"
              />
              <div v-else class="video-thumb-placeholder">▶</div>
              <div class="video-info">
                <span class="video-title">{{ video.title }}</span>
                <span class="video-meta">
                  <span class="video-channel">{{ video.channelTitle }}</span>
                  <span class="video-cat">{{ video.category }}</span>
                </span>
              </div>
            </a>
          </div>
          <p v-if="filteredVideos.length === 0" class="no-results">
            No videos match your filter.
          </p>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useDashboardStore } from '../stores/dashboard'

const store = useDashboardStore()
const videoSearch = ref('')

const dominancePct = computed(() =>
  ((store.selectedPlaylist?.dominantRatio || 0) * 100).toFixed(0),
)

const privacyClass = computed(() => {
  const s = store.selectedPlaylist?.privacyStatus
  if (s === 'private') return 'chip-private'
  if (s === 'unlisted') return 'chip-unlisted'
  return 'chip-public'
})

const badgeClass = computed(() => {
  const l = store.selectedPlaylist?.focusLabel
  if (l === 'Highly Focused') return 'badge-highly-focused'
  if (l === 'Focused') return 'badge-focused'
  return 'badge-mixed'
})

const categoryBreakdown = computed(() => {
  const freq = store.selectedPlaylist?.categoryFrequency || {}
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1])
  if (!entries.length) return []
  const max = entries[0][1]
  return entries.map(([label, count]) => ({
    label,
    count,
    pct: ((count / max) * 100).toFixed(0),
  }))
})

const filteredVideos = computed(() => {
  if (!videoSearch.value) return store.selectedVideos
  const q = videoSearch.value.toLowerCase()
  return store.selectedVideos.filter(
    (v) =>
      v.title.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.channelTitle.toLowerCase().includes(q),
  )
})
</script>

<style scoped>
/* Overlay */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

/* Panel */
.detail-panel {
  width: min(620px, 100vw);
  height: 100vh;
  background: #121212;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Slide animation */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
}

.slide-enter-from .detail-panel,
.slide-leave-to .detail-panel {
  transform: translateX(100%);
}

.slide-enter-from,
.slide-leave-to {
  background: rgba(0, 0, 0, 0);
}

/* Header */
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-back {
  background: none;
  border: none;
  color: #3ea6ff;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
}

.btn-back:hover {
  text-decoration: underline;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s;
}

.btn:hover {
  opacity: 0.9;
}

.btn-primary {
  background: #3ea6ff;
  color: #0f0f0f;
}

.btn-sm {
  font-size: 12px;
}

/* Info */
.detail-info {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.detail-thumb {
  width: 160px;
  border-radius: 8px;
  flex-shrink: 0;
}

.detail-meta h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
}

.detail-desc {
  font-size: 12px;
  color: #888;
  margin-bottom: 10px;
  line-height: 1.4;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-chip {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  background: #272727;
  color: #ccc;
}

.chip-private {
  background: rgba(255, 78, 69, 0.15);
  color: #ff6b6b;
}

.chip-unlisted {
  background: rgba(255, 193, 7, 0.15);
  color: #ffd54f;
}

.chip-public {
  background: rgba(76, 175, 80, 0.15);
  color: #66bb6a;
}

/* Stats strip */
.stats-strip {
  display: flex;
  gap: 16px;
  background: #181818;
  border-radius: 10px;
  padding: 16px;
  border: 1px solid #222;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-val {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}

.stat-lbl {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Focus badges (reused) */
.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.badge-focused {
  background: rgba(76, 175, 80, 0.15);
  color: #66bb6a;
}

.badge-highly-focused {
  background: rgba(76, 175, 80, 0.25);
  color: #81c784;
}

.badge-mixed {
  background: rgba(255, 152, 0, 0.15);
  color: #ffb74d;
}

/* Category breakdown */
.category-breakdown {
  background: #181818;
  border-radius: 10px;
  padding: 16px;
  border: 1px solid #222;
}

.category-breakdown h3 {
  font-size: 13px;
  color: #aaa;
  margin-bottom: 12px;
}

.cat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 12px;
}

.cat-label {
  min-width: 130px;
  color: #ccc;
}

.cat-bar-wrap {
  flex: 1;
  height: 6px;
  background: #272727;
  border-radius: 3px;
  overflow: hidden;
}

.cat-bar {
  height: 100%;
  background: #3ea6ff;
  border-radius: 3px;
}

.cat-count {
  min-width: 30px;
  text-align: right;
  color: #888;
}

/* Video list */
.video-list h3 {
  font-size: 13px;
  color: #aaa;
  margin-bottom: 12px;
}

.video-search {
  width: 100%;
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e8e8e8;
  font-size: 12px;
  outline: none;
  margin-bottom: 12px;
}

.video-search:focus {
  border-color: #3ea6ff;
}

.video-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.video-card {
  display: flex;
  gap: 12px;
  background: #181818;
  border-radius: 8px;
  padding: 8px;
  border: 1px solid #222;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
}

.video-card:hover {
  border-color: #3ea6ff;
}

.video-thumb {
  width: 120px;
  height: 68px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.video-thumb-placeholder {
  width: 120px;
  height: 68px;
  border-radius: 6px;
  background: #272727;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #555;
  flex-shrink: 0;
}

.video-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
}

.video-title {
  font-size: 13px;
  font-weight: 500;
  color: #e8e8e8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.video-channel {
  color: #888;
}

.video-cat {
  color: #3ea6ff;
}

.no-results {
  text-align: center;
  padding: 24px;
  color: #555;
  font-size: 13px;
}
</style>
