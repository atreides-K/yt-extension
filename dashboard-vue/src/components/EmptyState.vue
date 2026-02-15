<template>
  <div class="empty-state">
    <div class="empty-icon">📊</div>
    <h2>No Data Yet</h2>
    <p>Open the extension popup and sign in to sync your playlists.</p>
  </div>
</template>

<style scoped>
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: #555;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h2 {
  font-size: 18px;
  margin-bottom: 8px;
  color: #888;
}

.empty-state p {
  font-size: 13px;
}
</style>
