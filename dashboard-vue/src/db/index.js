/**
 * IndexedDB persistence layer using `idb`.
 *
 * Stores dashboard data locally so the dashboard can load instantly
 * and then reconcile with chrome.storage.local for freshness.
 *
 * Database: "playlist-intelligence"
 *   Object stores:
 *     "keyval"     — generic key→value (globalStats, lastSync, preferences)
 *     "playlists"  — per-playlist records keyed by id
 */

import { openDB } from 'idb'

const DB_NAME = 'playlist-intelligence'
const DB_VERSION = 1

let dbPromise = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval')
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

// ─── Key-Value helpers ───────────────────────────────────────────────────────

export async function dbGet(key) {
  const db = await getDB()
  return db.get('keyval', key)
}

export async function dbSet(key, value) {
  const db = await getDB()
  return db.put('keyval', value, key)
}

export async function dbDelete(key) {
  const db = await getDB()
  return db.delete('keyval', key)
}

// ─── Playlist store helpers ──────────────────────────────────────────────────

export async function dbGetAllPlaylists() {
  const db = await getDB()
  return db.getAll('playlists')
}

export async function dbSetPlaylist(playlist) {
  const db = await getDB()
  return db.put('playlists', playlist)
}

export async function dbSetPlaylists(playlists) {
  const db = await getDB()
  const tx = db.transaction('playlists', 'readwrite')
  await Promise.all([
    ...playlists.map((p) => tx.store.put(p)),
    tx.done,
  ])
}

// ─── Clear everything ────────────────────────────────────────────────────────

export async function dbClear() {
  const db = await getDB()
  const tx1 = db.transaction('keyval', 'readwrite')
  await tx1.store.clear()
  await tx1.done
  const tx2 = db.transaction('playlists', 'readwrite')
  await tx2.store.clear()
  await tx2.done
}
