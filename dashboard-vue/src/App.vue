<template>
  <div v-if="store.isLoading" class="loading">
    <div class="loading-spinner"></div>
    <p>Loading dashboard…</p>
  </div>

  <Transition name="fade">
    <div v-if="!store.isLoading" class="dashboard">
      <template v-if="store.globalStats">
        <DashHeader />
        <SummaryCards />
        <CategoryChart />
        <PlaylistTable />
        <DashFooter />
        <PlaylistDetail />
      </template>
      <EmptyState v-else />
    </div>
  </Transition>
</template>

<script setup>
import { onMounted } from 'vue'
import { useDashboardStore } from './stores/dashboard'
import DashHeader from './components/DashHeader.vue'
import SummaryCards from './components/SummaryCards.vue'
import CategoryChart from './components/CategoryChart.vue'
import PlaylistTable from './components/PlaylistTable.vue'
import DashFooter from './components/DashFooter.vue'
import EmptyState from './components/EmptyState.vue'
import PlaylistDetail from './components/PlaylistDetail.vue'

const store = useDashboardStore()

onMounted(() => {
  store.loadData()
})
</script>

<style scoped>
.dashboard {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
  color: #888;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #333;
  border-top-color: #3ea6ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
