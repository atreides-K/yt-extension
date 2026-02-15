/**
 * Playlist Statistics Computation Engine.
 *
 * Computes per-playlist and global stats:
 *  - Category frequency map
 *  - Dominant category
 *  - Dominant ratio
 *  - Unique category count
 *  - Focus label
 */

import { getCategoryLabel } from "./category-map.js";

/**
 * Compute statistics for a single playlist given its video→category mapping.
 *
 * @param {Object} videoCategories - { videoId: { categoryId, category } }
 * @returns {Object} playlist stats
 */
export function computePlaylistStats(videoCategories) {
  const videos = Object.values(videoCategories);
  const totalVideos = videos.length;

  if (totalVideos === 0) {
    return {
      totalVideos: 0,
      categoryFrequency: {},
      dominantCategory: null,
      dominantCategoryId: null,
      dominantCount: 0,
      dominantRatio: 0,
      uniqueCategories: 0,
      focusLabel: "Empty"
    };
  }

  // Build frequency map: categoryId → count
  const freq = {};
  for (const v of videos) {
    const cid = v.categoryId || "unknown";
    freq[cid] = (freq[cid] || 0) + 1;
  }

  // Find dominant
  let dominantCategoryId = null;
  let dominantCount = 0;
  for (const [cid, count] of Object.entries(freq)) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantCategoryId = cid;
    }
  }

  const dominantRatio = dominantCount / totalVideos;
  const dominantCategory = getCategoryLabel(dominantCategoryId);
  const uniqueCategories = Object.keys(freq).length;

  // Build readable frequency map: categoryLabel → count
  const categoryFrequency = {};
  for (const [cid, count] of Object.entries(freq)) {
    const label = getCategoryLabel(cid);
    categoryFrequency[label] = (categoryFrequency[label] || 0) + count;
  }

  // Focus label
  let focusLabel;
  if (dominantRatio >= 0.8) {
    focusLabel = "Highly Focused";
  } else if (dominantRatio >= 0.5) {
    focusLabel = "Focused";
  } else {
    focusLabel = "Mixed";
  }

  return {
    totalVideos,
    categoryFrequency,
    dominantCategory,
    dominantCategoryId,
    dominantCount,
    dominantRatio,
    uniqueCategories,
    focusLabel
  };
}

/**
 * Compute global stats across all playlists.
 *
 * @param {Object} allPlaylistStats - { playlistId: { stats } }
 * @returns {Object} global stats
 */
export function computeGlobalStats(allPlaylistStats) {
  let totalPlaylists = 0;
  let totalVideos = 0;
  const globalCategoryFreq = {};

  for (const [, stats] of Object.entries(allPlaylistStats)) {
    totalPlaylists++;
    totalVideos += stats.totalVideos;

    for (const [label, count] of Object.entries(stats.categoryFrequency)) {
      globalCategoryFreq[label] = (globalCategoryFreq[label] || 0) + count;
    }
  }

  // Sort by frequency desc
  const sortedCategories = Object.entries(globalCategoryFreq)
    .sort((a, b) => b[1] - a[1]);

  return {
    totalPlaylists,
    totalVideos,
    categoryDistribution: Object.fromEntries(sortedCategories)
  };
}

/**
 * Compute per-playlist category distribution as normalized ratios.
 * Used by the reordering engine.
 *
 * @param {Object} stats - output of computePlaylistStats()
 * @returns {Object} { categoryId: ratio }
 */
export function getCategoryDistribution(videoCategories) {
  const videos = Object.values(videoCategories);
  const total = videos.length;
  if (total === 0) return {};

  const freq = {};
  for (const v of videos) {
    const cid = v.categoryId || "unknown";
    freq[cid] = (freq[cid] || 0) + 1;
  }

  const dist = {};
  for (const [cid, count] of Object.entries(freq)) {
    dist[cid] = count / total;
  }

  return dist;
}
