/**
 * Content Script — Injected into YouTube pages.
 *
 * Watches for the "Save to..." playlist modal and reorders
 * playlist items based on the current video's category.
 *
 * YouTube 2026 DOM selectors:
 *   Modal:     yt-sheet-view-model  (verify header text === "Save to...")
 *   Dropdown:  tp-yt-iron-dropdown.ytd-popup-container
 *   List:      yt-list-view-model[role="list"]
 *   Items:     yt-list-item-view-model  /  toggleable-list-item-view-model
 *   Title:     .yt-list-item-view-model__title
 *   Subtitle:  .yt-list-item-view-model__subtitle
 *   Checked:   aria-pressed="true" on yt-list-item-view-model
 *   Header:    h2.ytPanelHeaderViewModelTitleHeader  ("Save to...")
 */

(function () {
  "use strict";

  const LOG = "[PI]";
  const REORDER_ATTR = "data-pi-reordered";
  let processing = false;

  console.log(LOG, "Content script loaded on", window.location.href);

  // ─── Helpers ─────────────────────────────────────────────────────────

  function getCurrentVideoId() {
    const url = new URL(window.location.href);
    return url.searchParams.get("v") || null;
  }

  /**
   * Get the playlist title from a list item (yt-list-item-view-model).
   */
  function getItemTitle(item) {
    // Primary: .yt-list-item-view-model__title
    const title = item.querySelector(".yt-list-item-view-model__title");
    if (title?.textContent?.trim()) return title.textContent.trim();

    // Legacy fallback
    const legacy = item.querySelector("#label, yt-formatted-string");
    if (legacy?.textContent?.trim()) return legacy.textContent.trim();

    // aria-label fallback (e.g. "Food, Private, Not selected")
    const aria =
      item.getAttribute("aria-label") ||
      item.querySelector("[aria-label]")?.getAttribute("aria-label");
    if (aria) {
      const name = aria.split(",")[0]?.trim();
      if (name) return name;
    }

    return null;
  }

  // ─── Modal Detection ────────────────────────────────────────────────

  /**
   * Find the "Save to..." modal.  Returns the yt-sheet-view-model element
   * only if its header text matches "Save to...".
   */
  function findSaveModal() {
    // Primary: yt-sheet-view-model with header "Save to..."
    const sheets = document.querySelectorAll("yt-sheet-view-model");
    for (const sheet of sheets) {
      const header =
        sheet.querySelector("h2.ytPanelHeaderViewModelTitleHeader") ||
        sheet.querySelector(".ytPanelHeaderViewModelTitle");
      if (header && header.textContent.trim().startsWith("Save to")) {
        return sheet;
      }
    }

    // Fallback: tp-yt-iron-dropdown that contains playlist items
    const dropdowns = document.querySelectorAll(
      "tp-yt-iron-dropdown.ytd-popup-container"
    );
    for (const dd of dropdowns) {
      if (dd.querySelector("yt-list-item-view-model")) return dd;
    }

    // Legacy
    const legacy = document.querySelector("ytd-add-to-playlist-renderer");
    if (legacy) return legacy;

    return null;
  }

  /**
   * Find the list container and items inside a modal.
   * Returns { items: Element[], container: Element|null }
   */
  function findPlaylistItems(modal) {
    // yt-list-view-model[role="list"] is the proper container
    let container = modal.querySelector('yt-list-view-model[role="list"]');
    let items;

    if (container) {
      items = container.querySelectorAll("yt-list-item-view-model");
      // If yt-list-item-view-model items are wrapped in toggleable wrappers,
      // we still reorder the toggleable parents so the DOM stays consistent.
      const toggleables = container.querySelectorAll(
        "toggleable-list-item-view-model"
      );
      if (toggleables.length >= items.length && toggleables.length > 0) {
        items = toggleables;
      }
      if (items.length > 0) return { items: Array.from(items), container };
    }

    // Fallback: just grab items anywhere inside the modal
    items = modal.querySelectorAll("yt-list-item-view-model");
    if (items.length > 0) {
      return { items: Array.from(items), container: items[0].parentElement };
    }

    items = modal.querySelectorAll("toggleable-list-item-view-model");
    if (items.length > 0) {
      return { items: Array.from(items), container: items[0].parentElement };
    }

    // Legacy
    items = modal.querySelectorAll("ytd-playlist-add-to-option-renderer");
    if (items.length > 0) {
      return { items: Array.from(items), container: items[0].parentElement };
    }

    return { items: [], container: null };
  }

  /**
   * Wait for items inside the modal to stabilize (incremental load).
   */
  function waitForStable(modal, timeout = 4000) {
    return new Promise((resolve) => {
      let lastCount = 0;
      let stable = 0;

      const interval = setInterval(() => {
        const { items } = findPlaylistItems(modal);
        if (items.length > 0 && items.length === lastCount) {
          stable++;
          if (stable >= 3) {
            clearInterval(interval);
            resolve(findPlaylistItems(modal));
          }
        } else {
          lastCount = items.length;
          stable = 0;
        }
      }, 200);

      setTimeout(() => {
        clearInterval(interval);
        resolve(findPlaylistItems(modal));
      }, timeout);
    });
  }

  // ─── Main Logic ──────────────────────────────────────────────────────

  async function handleModalOpen(modal) {
    if (processing) return;
    processing = true;

    try {
      console.log(LOG, "Save modal detected, waiting for items to stabilize...");

      const { items, container } = await waitForStable(modal);

      if (!container || items.length === 0) {
        console.warn(LOG, "Items disappeared before stabilization.");
        return;
      }

      // Already processed?
      if (container.hasAttribute(REORDER_ATTR)) {
        console.log(LOG, "Already reordered, skipping.");
        return;
      }

      container.setAttribute(REORDER_ATTR, "true");

      const videoId = getCurrentVideoId();
      if (!videoId) {
        console.warn(LOG, "No video ID in URL:", window.location.href);
        return;
      }

      console.log(LOG, `${items.length} playlists found, video: ${videoId}`);

      // Log titles for debugging
      const titles = items.map((i) => getItemTitle(i)).filter(Boolean);
      console.log(LOG, "Playlist titles:", titles);

      // Ask background for reordered list
      const response = await chrome.runtime.sendMessage({
        type: "GET_REORDERED_PLAYLISTS",
        videoId,
      });

      if (!response) {
        console.warn(LOG, "No response from background.");
        return;
      }

      if (!response.success) {
        console.warn(LOG, "Reorder failed:", response.error);
        return;
      }

      console.log(LOG, `Video category: ${response.videoCategory}`);
      console.log(LOG, `Reordered entries: ${response.reordered?.length}`);

      reorderDOM(container, items, response.reordered, response.videoCategory);
    } catch (err) {
      console.error(LOG, "Error:", err);
    } finally {
      processing = false;
    }
  }

  // ─── DOM Reordering ──────────────────────────────────────────────────

  function reorderDOM(container, items, reorderedPlaylists, videoCategory) {
    // Banner above playlist list
    if (videoCategory && !document.querySelector(".pi-category-banner")) {
      const banner = document.createElement("div");
      banner.className = "pi-category-banner";
      banner.innerHTML = `
        <span class="pi-banner-icon">📊</span>
        <span class="pi-banner-text">
          Video: <strong>${escapeHtml(videoCategory)}</strong> — sorted by match
        </span>
      `;
      container.parentElement?.insertBefore(banner, container);
    }

    // Build a set of titles whose dominant category matches the video
    const matchingTitles = new Set();
    const plInfoByTitle = new Map();
    for (const pl of reorderedPlaylists) {
      plInfoByTitle.set(pl.title, pl);
      if (pl.score > 0) {
        matchingTitles.add(pl.title);
      }
    }

    // Partition items in original DOM order: matching first, rest after
    const matchedItems = [];
    const restItems = [];

    items.forEach((item) => {
      const t = getItemTitle(item);
      if (t && matchingTitles.has(t)) {
        matchedItems.push(item);
      } else {
        restItems.push(item);
      }
    });

    console.log(
      LOG,
      `Partitioned: ${matchedItems.length} dominant-match, ${restItems.length} rest (original order preserved).`
    );

    // Add badges to matched items
    matchedItems.forEach((item) => {
      const t = getItemTitle(item);
      const pl = plInfoByTitle.get(t);
      if (pl) addBadge(item, pl);
    });

    // Append: matched first (in original DOM order), then rest (in original DOM order)
    const fragment = document.createDocumentFragment();
    matchedItems.forEach((item) => fragment.appendChild(item));
    restItems.forEach((item) => fragment.appendChild(item));

    container.appendChild(fragment);
    console.log(
      LOG,
      `Done! ${matchedItems.length} promoted to top, ${restItems.length} kept below.`
    );
  }

  function addBadge(element, pl) {
    if (element.querySelector(".pi-score-badge") || pl.score <= 0) return;

    const badge = document.createElement("span");
    badge.className = "pi-score-badge";

    if (pl.score > 1) {
      badge.classList.add("pi-score-high");
      badge.textContent = "★";
      badge.title = `Best match — ${(pl.matchRatio * 100).toFixed(0)}% ${pl.dominantCategory}`;
    } else {
      badge.classList.add("pi-score-medium");
      badge.textContent = "●";
      badge.title = `Partial match — ${(pl.matchRatio * 100).toFixed(0)}%`;
    }

    element.style.position = "relative";
    element.appendChild(badge);
  }

  // ─── Observer ────────────────────────────────────────────────────────

  const observer = new MutationObserver(() => {
    const modal = findSaveModal();
    if (!modal) return;

    const { items, container } = findPlaylistItems(modal);
    if (
      items.length > 0 &&
      container &&
      !container.hasAttribute(REORDER_ATTR)
    ) {
      console.log(LOG, `Observer triggered — modal found with ${items.length} items.`);
      handleModalOpen(modal);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log(LOG, "Observer active — watching for 'Save to...' modal.");

  // ─── YouTube SPA Navigation ──────────────────────────────────────────

  window.addEventListener("yt-navigate-finish", () => {
    document
      .querySelectorAll(`[${REORDER_ATTR}]`)
      .forEach((el) => el.removeAttribute(REORDER_ATTR));
    document
      .querySelectorAll(".pi-category-banner")
      .forEach((el) => el.remove());
    document
      .querySelectorAll(".pi-score-badge")
      .forEach((el) => el.remove());
    processing = false;
    console.log(LOG, "Navigation — state reset.");
  });

  // ─── Util ────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
