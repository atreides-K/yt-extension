<template>
  <header class="dash-header">
    <h1>📊 Playlist Intelligence Dashboard</h1>
    <div class="header-actions">
      <span v-if="store.syncError" class="sync-error">{{ store.syncError }}</span>
      <button
        class="btn btn-secondary"
        :disabled="store.isSyncing"
        @click="store.refresh()"
      >
        {{ store.isSyncing ? 'Syncing…' : '🔄 Refresh' }}
      </button>
    </div>
  </header>
</template>

<script setup>
import { useDashboardStore } from '../stores/dashboard'

const store = useDashboardStore()
</script>

<style scoped>
.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid #222;
}

.dash-header h1 {
  font-size: 22px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sync-error {
  color: #ff4e45;
  font-size: 12px;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn:hover {
  opacity: 0.9;
}

.btn:active {
  opacity: 0.8;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #272727;
  color: #e8e8e8;
}
</style>
