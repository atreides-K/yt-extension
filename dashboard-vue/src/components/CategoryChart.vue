<template>
  <section class="chart-section">
    <h2>Category Distribution</h2>
    <div class="pie-chart-container">
      <canvas ref="canvasRef" width="300" height="300"></canvas>
      <div class="pie-legend">
        <div
          v-for="(entry, idx) in chartEntries"
          :key="entry.label"
          class="legend-item"
          :class="{ dimmed: highlightIdx !== null && highlightIdx !== idx }"
          @mouseenter="highlightIdx = idx"
          @mouseleave="highlightIdx = null"
        >
          <span
            class="legend-color"
            :style="{ background: colors[idx % colors.length] }"
          ></span>
          <span class="legend-label">{{ entry.label }}</span>
          <span class="legend-count">{{ entry.count }} ({{ entry.pct }}%)</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useDashboardStore } from '../stores/dashboard'

const store = useDashboardStore()
const canvasRef = ref(null)
const highlightIdx = ref(null)

const colors = [
  '#3ea6ff', '#f5c518', '#ff4e45', '#4caf50', '#ab47bc',
  '#ff7043', '#26c6da', '#ec407a', '#66bb6a', '#ffa726',
  '#8d6e63', '#78909c', '#5c6bc0', '#29b6f6', '#d4e157',
  '#ef5350', '#7e57c2', '#26a69a', '#ffee58', '#bdbdbd',
]

const chartEntries = computed(() => {
  const entries = Object.entries(store.categoryDistribution)
    .sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, c]) => s + c, 0)
  if (total === 0) return []
  return entries.map(([label, count]) => ({
    label,
    count,
    pct: ((count / total) * 100).toFixed(1),
  }))
})

function drawChart() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const entries = chartEntries.value
  const total = entries.reduce((s, e) => s + e.count, 0)
  if (total === 0) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const radius = Math.min(cx, cy) - 10

  let startAngle = -Math.PI / 2

  entries.forEach((entry, idx) => {
    const sliceAngle = (entry.count / total) * 2 * Math.PI
    const isHighlighted = highlightIdx.value === idx
    const drawRadius = isHighlighted ? radius + 6 : radius

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, drawRadius, startAngle, startAngle + sliceAngle)
    ctx.closePath()
    ctx.fillStyle = colors[idx % colors.length]
    ctx.globalAlpha =
      highlightIdx.value !== null && !isHighlighted ? 0.4 : 1
    ctx.fill()
    ctx.globalAlpha = 1

    startAngle += sliceAngle
  })

  // Center hole (donut)
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.55, 0, 2 * Math.PI)
  ctx.fillStyle = '#181818'
  ctx.fill()

  // Center text
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 28px Segoe UI, Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(total.toString(), cx, cy - 8)
  ctx.font = '11px Segoe UI, Roboto, sans-serif'
  ctx.fillStyle = '#888'
  ctx.fillText('videos', cx, cy + 14)
}

onMounted(() => {
  drawChart()
})

watch(
  () => store.categoryDistribution,
  () => nextTick(drawChart),
  { deep: true },
)

watch(highlightIdx, () => drawChart())
</script>

<style scoped>
.chart-section {
  background: #181818;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
  border: 1px solid #222;
}

.chart-section h2 {
  font-size: 16px;
  margin-bottom: 20px;
  color: #ccc;
}

.pie-chart-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  flex-wrap: wrap;
}

canvas {
  max-width: 300px;
  max-height: 300px;
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: default;
  transition: opacity 0.15s;
}

.legend-item.dimmed {
  opacity: 0.4;
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-label {
  color: #ccc;
}

.legend-count {
  color: #888;
  font-size: 12px;
  margin-left: auto;
}
</style>
