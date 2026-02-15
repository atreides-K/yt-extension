/**
 * YouTube Category ID → Label mapping.
 * These are the standard YouTube video categories.
 * Cached locally to avoid repeated API calls.
 */

export const CATEGORY_MAP = {
  "1":  "Film & Animation",
  "2":  "Autos & Vehicles",
  "10": "Music",
  "15": "Pets & Animals",
  "17": "Sports",
  "18": "Short Movies",
  "19": "Travel & Events",
  "20": "Gaming",
  "21": "Videoblogging",
  "22": "People & Blogs",
  "23": "Comedy",
  "24": "Entertainment",
  "25": "News & Politics",
  "26": "Howto & Style",
  "27": "Education",
  "28": "Science & Technology",
  "29": "Nonprofits & Activism",
  "30": "Movies",
  "31": "Anime/Animation",
  "32": "Action/Adventure",
  "33": "Classics",
  "34": "Comedy",
  "35": "Documentary",
  "36": "Drama",
  "37": "Family",
  "38": "Foreign",
  "39": "Horror",
  "40": "Sci-Fi/Fantasy",
  "41": "Thriller",
  "42": "Shorts",
  "43": "Shows",
  "44": "Trailers"
};

/**
 * Get human-readable label for a category ID.
 * @param {string} categoryId
 * @returns {string}
 */
export function getCategoryLabel(categoryId) {
  return CATEGORY_MAP[categoryId] || "Unknown";
}

/**
 * Get all category IDs.
 * @returns {string[]}
 */
export function getAllCategoryIds() {
  return Object.keys(CATEGORY_MAP);
}
