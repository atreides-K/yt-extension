<template>
  <section class="table-section">
    <h2>Playlist Breakdown</h2>

    <div class="table-controls">
      <input
        type="text"
        v-model="store.searchQuery"
        placeholder="Search playlists…"
      />
      <select v-model="store.filterCategory">
        <option value="">All Categories</option>
        <option v-for="cat in store.allCategories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
      <select v-model="store.sortBy">
        <option value="name">Sort by Name</option>
        <option value="videos">Sort by Videos</option>
        <option value="ratio">Sort by Dominance</option>
        <option value="focus">Sort by Focus</option>
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
      </select>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="th-idx">#</th>
            <th>Playlist</th>
            <th>Videos</th>
            <th>Dominant Category</th>
            <th>Dominance</th>
            <th>Focus</th>
            <th>Created</th>
            <th class="th-actions">Actions</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="row">
          <tr v-for="(row, idx) in store.playlistRows" :key="row.id">
            <td class="cell-idx">{{ idx + 1 }}</td>
            <td class="cell-name">{{ row.name }}</td>
            <td>{{ row.totalVideos }}</td>
            <td>{{ row.dominantCategory }}</td>
            <td>
              <div class="dominance-cell">
                <span class="dominance-bar-wrap">
                  <span
                    class="dominance-bar"
                    :style="{
                      width: pct(row.dominantRatio) + '%',
                      background: barColor(row.dominantRatio),
                    }"
                  ></span>
                </span>
                <span class="dominance-pct">{{ pct(row.dominantRatio) }}%</span>
              </div>
            </td>
            <td>
              <span :class="['badge', badgeClass(row.focusLabel)]">
                {{ row.focusLabel }}
              </span>
            </td>
            <td class="cell-created">{{ formatDate(row.createdAt) }}</td>
            <td class="cell-actions">
              <a
                :href="row.url"
                target="_blank"
                rel="noopener"
                class="action-btn"
                title="Open on YouTube"
                @click.stop
              >▶</a>
              <button
                class="action-btn"
                title="View details"
                @click="store.selectPlaylist(row.id)"
              >📋</button>
            </td>
          </tr>
        </TransitionGroup>
      </table>

      <p v-if="store.playlistRows.length === 0" class="no-results">
        No playlists match your search.
      </p>
    </div>
  </section>
</template>

<script setup>
import { useDashboardStore } from '../stores/dashboard'

const store = useDashboardStore()

function pct(ratio) {
  return (ratio * 100).toFixed(0)
}

function barColor(ratio) {
  if (ratio >= 0.8) return '#4caf50'
  if (ratio >= 0.5) return '#3ea6ff'
  return '#ff9800'
}

function badgeClass(label) {
  switch (label) {
    case 'Highly Focused':
      return 'badge-highly-focused'
    case 'Focused':
      return 'badge-focused'
    default:
      return 'badge-mixed'
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.table-section {
  background: #181818;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
  border: 1px solid #222;
}

.table-section h2 {
  font-size: 16px;
  margin-bottom: 16px;
  color: #ccc;
}

.table-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.table-controls input,
.table-controls select {
  background: #0f0f0f;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e8e8e8;
  font-size: 12px;
  outline: none;
}

.table-controls input {
  flex: 1;
}

.table-controls input:focus,
.table-controls select:focus {
  border-color: #3ea6ff;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 10px 14px;
  background: #0f0f0f;
  color: #888;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #333;
  position: sticky;
  top: 0;
}

td {
  padding: 12px 14px;
  border-bottom: 1px solid #1a1a1a;
  font-size: 13px;
}

tr:hover td {
  background: rgba(62, 166, 255, 0.04);
}

.cell-name {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Focus badges */
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

/* Dominance bar */
.dominance-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dominance-bar-wrap {
  flex: 1;
  height: 6px;
  background: #272727;
  border-radius: 3px;
  overflow: hidden;
  min-width: 60px;
}

.dominance-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s;
}

.dominance-pct {
  font-size: 12px;
  color: #aaa;
  min-width: 36px;
  text-align: right;
}

/* No results */
.no-results {
  text-align: center;
  padding: 24px;
  color: #555;
  font-size: 13px;
}

/* TransitionGroup animations */
.row-enter-active,
.row-leave-active {
  transition: all 0.3s ease;
}

.row-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.row-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.row-move {
  transition: transform 0.3s ease;
}

/* Index column */
.th-idx,
.cell-idx {
  width: 40px;
  text-align: center;
  color: #555;
  font-variant-numeric: tabular-nums;
}

.cell-created {
  white-space: nowrap;
  color: #888;
  font-size: 12px;
}

/* Actions column */
.th-actions {
  width: 80px;
  text-align: center;
}

.cell-actions {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid #333;
  background: #0f0f0f;
  color: #ccc;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}

.action-btn:hover {
  border-color: #3ea6ff;
  background: rgba(62, 166, 255, 0.1);
  color: #3ea6ff;
}
</style>
