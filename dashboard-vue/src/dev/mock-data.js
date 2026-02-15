/**
 * Mock data for local development (npm run dev).
 *
 * When the dashboard runs on localhost instead of inside the Chrome extension,
 * chrome.storage.local is unavailable. This file provides realistic seed data
 * so you can develop and style the UI without needing a real sync.
 */

export const mockGlobalStats = {
  totalPlaylists: 8,
  totalVideos: 247,
  categoryDistribution: {
    'Music': 72,
    'Gaming': 48,
    'Education': 35,
    'Science & Technology': 28,
    'Entertainment': 24,
    'People & Blogs': 18,
    'Film & Animation': 12,
    'Comedy': 10,
  },
}

export const mockPlaylistStats = {
  PLabc001: {
    totalVideos: 45,
    dominantCategory: 'Music',
    dominantCategoryId: '10',
    dominantRatio: 0.89,
    dominantCount: 40,
    uniqueCategories: 3,
    focusLabel: 'Highly Focused',
    categoryFrequency: { Music: 40, Entertainment: 3, 'People & Blogs': 2 },
  },
  PLabc002: {
    totalVideos: 38,
    dominantCategory: 'Gaming',
    dominantCategoryId: '20',
    dominantRatio: 0.84,
    dominantCount: 32,
    uniqueCategories: 4,
    focusLabel: 'Highly Focused',
    categoryFrequency: { Gaming: 32, Entertainment: 3, 'Science & Technology': 2, Comedy: 1 },
  },
  PLabc003: {
    totalVideos: 52,
    dominantCategory: 'Education',
    dominantCategoryId: '27',
    dominantRatio: 0.62,
    dominantCount: 32,
    uniqueCategories: 5,
    focusLabel: 'Focused',
    categoryFrequency: { Education: 32, 'Science & Technology': 10, 'People & Blogs': 5, 'Film & Animation': 3, Music: 2 },
  },
  PLabc004: {
    totalVideos: 28,
    dominantCategory: 'Science & Technology',
    dominantCategoryId: '28',
    dominantRatio: 0.57,
    dominantCount: 16,
    uniqueCategories: 4,
    focusLabel: 'Focused',
    categoryFrequency: { 'Science & Technology': 16, Education: 5, 'People & Blogs': 4, Entertainment: 3 },
  },
  PLabc005: {
    totalVideos: 22,
    dominantCategory: 'Entertainment',
    dominantCategoryId: '24',
    dominantRatio: 0.45,
    dominantCount: 10,
    uniqueCategories: 6,
    focusLabel: 'Mixed',
    categoryFrequency: { Entertainment: 10, Music: 4, Comedy: 3, Gaming: 2, 'Film & Animation': 2, 'People & Blogs': 1 },
  },
  PLabc006: {
    totalVideos: 18,
    dominantCategory: 'Music',
    dominantCategoryId: '10',
    dominantRatio: 0.94,
    dominantCount: 17,
    uniqueCategories: 2,
    focusLabel: 'Highly Focused',
    categoryFrequency: { Music: 17, Entertainment: 1 },
  },
  PLabc007: {
    totalVideos: 31,
    dominantCategory: 'Film & Animation',
    dominantCategoryId: '1',
    dominantRatio: 0.35,
    dominantCount: 11,
    uniqueCategories: 5,
    focusLabel: 'Mixed',
    categoryFrequency: { 'Film & Animation': 11, Entertainment: 8, Comedy: 6, Music: 4, Gaming: 2 },
  },
  PLabc008: {
    totalVideos: 13,
    dominantCategory: 'Comedy',
    dominantCategoryId: '23',
    dominantRatio: 0.69,
    dominantCount: 9,
    uniqueCategories: 3,
    focusLabel: 'Focused',
    categoryFrequency: { Comedy: 9, Entertainment: 3, 'People & Blogs': 1 },
  },
}

export const mockPlaylistMeta = {
  PLabc001: {
    title: 'Chill Vibes',
    description: 'Lo-fi, ambient, and chill tracks for working and relaxing.',
    url: 'https://www.youtube.com/playlist?list=PLabc001',
    thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg',
    publishedAt: '2019-03-15T10:22:00Z',
    privacyStatus: 'public',
    videoCount: 45,
  },
  PLabc002: {
    title: "Let's Play Archive",
    description: 'Full playthroughs and highlights from various games.',
    url: 'https://www.youtube.com/playlist?list=PLabc002',
    thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    publishedAt: '2020-07-01T14:00:00Z',
    privacyStatus: 'public',
    videoCount: 38,
  },
  PLabc003: {
    title: 'Learn Something New',
    description: 'Educational content: science, math, and history deep dives.',
    url: 'https://www.youtube.com/playlist?list=PLabc003',
    thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    publishedAt: '2021-01-10T08:30:00Z',
    privacyStatus: 'public',
    videoCount: 52,
  },
  PLabc004: {
    title: 'Tech Deep Dives',
    description: 'In-depth looks at programming, AI, and hardware.',
    url: 'https://www.youtube.com/playlist?list=PLabc004',
    thumbnail: '',
    publishedAt: '2022-05-22T16:45:00Z',
    privacyStatus: 'public',
    videoCount: 28,
  },
  PLabc005: {
    title: 'Random Favs',
    description: '',
    url: 'https://www.youtube.com/playlist?list=PLabc005',
    thumbnail: '',
    publishedAt: '2018-11-03T20:00:00Z',
    privacyStatus: 'public',
    videoCount: 22,
  },
  PLabc006: {
    title: 'Workout Beats',
    description: 'High-energy music for the gym.',
    url: 'https://www.youtube.com/playlist?list=PLabc006',
    thumbnail: '',
    publishedAt: '2023-02-14T09:15:00Z',
    privacyStatus: 'private',
    videoCount: 18,
  },
  PLabc007: {
    title: 'Movie Night',
    description: 'Trailers, reviews, and behind-the-scenes content.',
    url: 'https://www.youtube.com/playlist?list=PLabc007',
    thumbnail: '',
    publishedAt: '2024-08-30T11:00:00Z',
    privacyStatus: 'public',
    videoCount: 31,
  },
  PLabc008: {
    title: 'Funny Stuff',
    description: 'Sketches and stand-up clips that crack me up.',
    url: 'https://www.youtube.com/playlist?list=PLabc008',
    thumbnail: '',
    publishedAt: '2017-06-18T13:30:00Z',
    privacyStatus: 'unlisted',
    videoCount: 13,
  },
}

// ─── Per-playlist video data (simulates playlistCategories from chrome.storage)

function fakeVideos(playlistId, count, categories) {
  const videos = {}
  const catEntries = Object.entries(categories)
  let idx = 0
  for (const [cat, n] of catEntries) {
    for (let i = 0; i < n && idx < count; i++, idx++) {
      const vid = `${playlistId}_v${String(idx).padStart(3, '0')}`
      videos[vid] = {
        categoryId: cat,
        category: cat,
        title: `${cat} Video ${i + 1} – Sample Title`,
        channelTitle: `Channel ${String.fromCharCode(65 + (idx % 26))}`,
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      }
    }
  }
  return videos
}

export const mockPlaylistCategories = {
  PLabc001: fakeVideos('PLabc001', 45, { Music: 40, Entertainment: 3, 'People & Blogs': 2 }),
  PLabc002: fakeVideos('PLabc002', 38, { Gaming: 32, Entertainment: 3, 'Science & Technology': 2, Comedy: 1 }),
  PLabc003: fakeVideos('PLabc003', 52, { Education: 32, 'Science & Technology': 10, 'People & Blogs': 5, 'Film & Animation': 3, Music: 2 }),
  PLabc004: fakeVideos('PLabc004', 28, { 'Science & Technology': 16, Education: 5, 'People & Blogs': 4, Entertainment: 3 }),
  PLabc005: fakeVideos('PLabc005', 22, { Entertainment: 10, Music: 4, Comedy: 3, Gaming: 2, 'Film & Animation': 2, 'People & Blogs': 1 }),
  PLabc006: fakeVideos('PLabc006', 18, { Music: 17, Entertainment: 1 }),
  PLabc007: fakeVideos('PLabc007', 31, { 'Film & Animation': 11, Entertainment: 8, Comedy: 6, Music: 4, Gaming: 2 }),
  PLabc008: fakeVideos('PLabc008', 13, { Comedy: 9, Entertainment: 3, 'People & Blogs': 1 }),
}

export const mockLastSync = Date.now() - 3600_000 // 1 hour ago
