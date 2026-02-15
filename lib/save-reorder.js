/**
 * Save Suggestion Reordering Engine.
 *
 * When the user saves a video, this module scores playlists
 * and returns them sorted by relevance to the video's category.
 *
 * Scoring formula (from PRD §6.4):
 *   category_match_score = category_distribution[video_category] / total_videos
 *   dominant_bonus = 1 if dominant_category == video_category else 0
 *   final_score = dominant_bonus + category_match_score
 */

/**
 * Score and reorder playlists for a given video category.
 *
 * @param {string} videoCategoryId - The categoryId of the video being saved
 * @param {Object} playlistData - Map of playlistId → {
 *   title: string,
 *   stats: {
 *     totalVideos: number,
 *     dominantCategoryId: string,
 *     categoryFrequency: Object  // label → count (not used directly)
 *   },
 *   categoryDistribution: Object  // categoryId → ratio
 * }
 * @returns {Array<{playlistId, title, score, dominantCategory, matchRatio}>}
 */
export function reorderPlaylists(videoCategoryId, playlistData) {
  const scored = [];
  console.log("Playlist data for reordering:", playlistData);
  for (const [playlistId, data] of Object.entries(playlistData)) {
    const { title, stats, categoryDistribution } = data;

    // commented out category match score as i just want reorder based on dominant category and recenct
    // Category match score: what fraction of this playlist is the target category
    // const categoryMatchScore = categoryDistribution[videoCategoryId] || 0;

    // Dominant bonus: 1 if this playlist's dominant category matches the video
    const dominantBonus = stats.dominantCategoryId === videoCategoryId ? 1 : 0;

    // Final score
    const score = dominantBonus ;

    scored.push({
      playlistId,
      title,
      score,
      dominantCategory: stats.dominantCategory,
      dominantRatio: stats.dominantRatio,
      // matchRatio: categoryMatchScore,
      focusLabel: stats.focusLabel,
      totalVideos: stats.totalVideos
    });
  }

  // Sort descending by score, then by title alphabetically for ties
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Quick check: does a playlist have any videos of the given category?
 * @param {string} videoCategoryId
 * @param {Object} categoryDistribution - categoryId → ratio
 * @returns {boolean}
 */
export function playlistContainsCategory(videoCategoryId, categoryDistribution) {
  return (categoryDistribution[videoCategoryId] || 0) > 0;
}
