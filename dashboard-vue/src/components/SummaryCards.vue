<template>
  <section class="summary-section">
    <div
      v-for="card in cards"
      :key="card.label"
      class="summary-card"
    >
      <span class="summary-value">{{ card.value }}</span>
      <span class="summary-label">{{ card.label }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useDashboardStore } from '../stores/dashboard'

const store = useDashboardStore()

const cards = computed(() => [
  { label: 'Total Playlists', value: store.totalPlaylists },
  { label: 'Total Videos', value: store.totalVideos },
  { label: 'Unique Categories', value: store.uniqueCategories },
  { label: 'Top Category', value: store.topCategory },
])
</script>

<style scoped>
.summary-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.summary-card {
  background: #181818;
  border-radius: 12px;
  padding: 24px 20px;
  text-align: center;
  border: 1px solid #222;
  transition: border-color 0.2s;
}

.summary-card:hover {
  border-color: #3ea6ff;
}

.summary-value {
  display: block;
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.summary-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
