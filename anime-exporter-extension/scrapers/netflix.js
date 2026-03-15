// Netflix scraper — reads Continue Watching, My List, and browsed titles
// Runs on netflix.com pages as a content script

(function() {
  window.__animeExporter_netflix = async function() {
    const results = { watching: [], planned: [], completed: [] };

    // Helper: clean title text
    const cleanTitle = el => el ? el.textContent.trim().replace(/\s+/g, ' ') : null;

    // Strategy 1: Read window.__NETFLIX_BUILD_IDENTIFIER__ and netflix's
    // react fiber tree for richer data (works on most Netflix page loads)
    function readFiber(domNode) {
      const key = Object.keys(domNode).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
      return key ? domNode[key] : null;
    }

    function extractFromFiber(fiber, depth = 0) {
      if (!fiber || depth > 40) return [];
      const titles = [];
      try {
        const props = fiber.memoizedProps || fiber.pendingProps || {};
        // Look for video metadata props common to Netflix cards
        if (props && props.videoId && props.title) {
          titles.push({ title: props.title, id: String(props.videoId) });
        }
        if (props && props.rowTitle && props.videos) {
          props.videos.forEach(v => { if (v.title) titles.push({ title: v.title, id: String(v.id || '') }); });
        }
      } catch(e) {}
      if (fiber.child) titles.push(...extractFromFiber(fiber.child, depth + 1));
      if (fiber.sibling) titles.push(...extractFromFiber(fiber.sibling, depth + 1));
      return titles;
    }

    // Strategy 2: DOM scraping — works reliably as fallback
    function scrapeDOM() {
      const found = { watching: [], planned: [] };

      // Continue Watching row
      const rows = document.querySelectorAll('[data-list-context], .lolomoRow, [class*="lolomo"]');
      rows.forEach(row => {
        const rowLabel = row.querySelector('[class*="rowHeader"], [class*="row-header"], .rowTitle, [data-uia="row-title"]');
        const labelText = rowLabel ? rowLabel.textContent.toLowerCase() : '';
        const isContinue = labelText.includes('continue') || labelText.includes('watching') || row.getAttribute('data-list-context') === 'continueWatching';
        const isMyList = labelText.includes('my list') || row.getAttribute('data-list-context') === 'queue';

        const cards = row.querySelectorAll('.slider-item, [class*="title-card"], [class*="titleCard"], [data-uia*="title"]');
        cards.forEach(card => {
          const titleEl = card.querySelector('[class*="fallback-text"], [class*="title-title"], .title, [aria-label]');
          const title = cleanTitle(titleEl) || card.getAttribute('aria-label');
          if (!title || title.length < 2) return;

          // Try to get progress bar
          const progressBar = card.querySelector('[class*="progress"], progress');
          const hasProgress = !!progressBar;

          const item = { title, source: 'Netflix', progress: hasProgress ? 'In Progress' : null };

          if (isContinue || hasProgress) {
            found.watching.push(item);
          } else if (isMyList) {
            found.planned.push(item);
          }
        });
      });

      // Also grab all visible title cards with aria-labels as a broad sweep
      if (found.watching.length === 0) {
        document.querySelectorAll('[aria-label][class*="card"], [aria-label][class*="Card"]').forEach(el => {
          const label = el.getAttribute('aria-label');
          if (label && label.length > 1) {
            found.watching.push({ title: label.trim(), source: 'Netflix' });
          }
        });
      }

      return found;
    }

    // Strategy 3: Netflix's internal JSON cache (shakti API data sometimes cached in window)
    function readNetflixCache() {
      const items = [];
      try {
        const netflix = window.netflix;
        if (netflix && netflix.falcorCache) {
          const cache = netflix.falcorCache;
          // Walk the falcor cache for video entries
          Object.keys(cache).forEach(key => {
            if (key === 'videos') {
              const videos = cache[key];
              Object.keys(videos).forEach(id => {
                const v = videos[id];
                if (v && v.title && v.title.value) {
                  items.push({ title: v.title.value, id, source: 'Netflix' });
                }
              });
            }
          });
        }
      } catch(e) {}
      return items;
    }

    // Run all strategies and merge
    const cacheItems = readNetflixCache();
    const domResult = scrapeDOM();

    if (cacheItems.length > 0) {
      // If we got cache data, it's more reliable — use it as watching
      results.watching = cacheItems.slice(0, 200);
    } else {
      results.watching = domResult.watching.slice(0, 200);
      results.planned = domResult.planned.slice(0, 200);
    }

    // Deduplicate by title
    const dedup = arr => {
      const seen = new Set();
      return arr.filter(item => {
        if (seen.has(item.title)) return false;
        seen.add(item.title);
        return true;
      });
    };

    results.watching = dedup(results.watching);
    results.planned = dedup(results.planned);

    return {
      platform: 'Netflix',
      counts: { watching: results.watching.length, planned: results.planned.length, completed: 0 },
      data: results
    };
  };
})();
