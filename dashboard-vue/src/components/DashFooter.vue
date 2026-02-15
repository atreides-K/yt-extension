<template>
  <footer class="dash-footer">
    <span>{{ formattedSync }}</span>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { useDashboardStore } from '../stores/dashboard'

const store = useDashboardStore()

const formattedSync = computed(() => {
  if (!store.lastSync) return 'Last sync: never'
  const d = new Date(store.lastSync)
  return `Last sync: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
})
</script>

<style scoped>
.dash-footer {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid #222;
  color: #555;
  font-size: 11px;
}
</style>
