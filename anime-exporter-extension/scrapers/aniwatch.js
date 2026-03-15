// AniWatch / Aniwave scraper — reads watchlist and continue watching
(function() {
  window.__animeExporter_aniwatch = async function() {
    const results = { watching: [], planned: [], completed: [] };

    function cleanTitle(el) {
      return el ? el.textContent.trim().replace(/\s+/g, ' ') : null;
    }

    // AniWatch stores some data in localStorage
    function readLocalStorage() {
      const items = { watching: [], planned: [], completed: [] };
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const val = localStorage.getItem(key);
          if (!val) continue;
          try {
            const data = JSON.parse(val);
            // AniWatch stores episode progress as { animeId: { ep, title } }
            if (data && typeof data === 'object') {
              Object.values(data).forEach(entry => {
                if (entry && entry.title) {
                  items.watching.push({ title: entry.title, source: 'AniWatch', progress: entry.ep ? `Ep ${entry.ep}` : null });
                }
              });
            }
          } catch(e) {}
        }
      } catch(e) {}
      return items;
    }

    // DOM scraping for watchlist page and continue watching
    function scrapeDOM() {
      const watching = [];
      const planned = [];
      const completed = [];

      const isWatchlistPage = window.location.pathname.includes('watchlist');

      if (isWatchlistPage) {
        // AniWatch renders ALL status sections in the DOM simultaneously.
        // Each section has a data-status attr or an id containing the status name.
        // We walk each section independently so items get the right label.

        // Map of section identifiers → our bucket
        const statusMap = [
          { keys: ['watching', 'currently-watching', 'watch'],  bucket: watching  },
          { keys: ['plan', 'plan-to-watch', 'planning'],        bucket: planned   },
          { keys: ['completed', 'complete', 'finish'],          bucket: completed },
          { keys: ['on-hold', 'onhold', 'hold', 'paused'],      bucket: watching  }, // on-hold → watching
          { keys: ['dropped'],                                   bucket: completed }, // dropped → completed
        ];

        // Find all section containers — AniWatch uses divs with id or data-status
        // e.g. <div id="watchlist-watching">, <div data-status="completed">, etc.
        const allSections = document.querySelectorAll(
          '[id*="watchlist-"], [data-status], [class*="watchlist-status"], [class*="status-section"]'
        );

        if (allSections.length > 0) {
          allSections.forEach(section => {
            const raw = (
              section.getAttribute('data-status') ||
              section.id ||
              section.className ||
              ''
            ).toLowerCase();

            let bucket = null;
            for (const { keys, bucket: b } of statusMap) {
              if (keys.some(k => raw.includes(k))) { bucket = b; break; }
            }
            if (!bucket) return; // unrecognised section, skip

            section.querySelectorAll('.flw-item, [class*="item"], [class*="card"]').forEach(card => {
              const titleEl = card.querySelector(
                '.dynamic-name, [data-jname], [class*="film-name"], [class*="title"], h3, h4, a[title]'
              );
              const title = cleanTitle(titleEl)
                || titleEl?.getAttribute('data-jname')
                || titleEl?.getAttribute('title')
                || card.getAttribute('data-title');
              if (title && title.length > 1 && title.length < 160) {
                bucket.push({ title, source: 'AniWatch' });
              }
            });
          });
        } else {
          // Fallback: AniWatch sometimes uses a single list with per-item data-status
          document.querySelectorAll('.flw-item, [class*="item"]').forEach(card => {
            const raw = (
              card.getAttribute('data-status') ||
              card.closest('[data-status]')?.getAttribute('data-status') ||
              ''
            ).toLowerCase();

            const titleEl = card.querySelector(
              '.dynamic-name, [data-jname], [class*="film-name"], h3, h4, a[title]'
            );
            const title = cleanTitle(titleEl)
              || titleEl?.getAttribute('title')
              || card.getAttribute('data-title');
            if (!title || title.length < 2) return;

            const entry = { title, source: 'AniWatch' };
            if (raw.includes('plan')) planned.push(entry);
            else if (raw.includes('complet') || raw.includes('drop')) completed.push(entry);
            else watching.push(entry);
          });
        }
      }

      // Continue watching section on homepage (always → watching)
      const continueSections = document.querySelectorAll(
        '[class*="continue"], [class*="Continue"], [id*="continue"]'
      );
      continueSections.forEach(section => {
        section.querySelectorAll('.dynamic-name, [class*="film-name"], [class*="title"]').forEach(el => {
          const title = cleanTitle(el);
          if (title && title.length > 2) watching.push({ title, source: 'AniWatch' });
        });
      });

      // Last-resort broad sweep when on a non-watchlist page
      if (!isWatchlistPage && watching.length === 0) {
        document.querySelectorAll('.flw-item').forEach(card => {
          const titleEl = card.querySelector('.dynamic-name, [class*="film-name"]');
          const title = cleanTitle(titleEl) || card.querySelector('a')?.getAttribute('title');
          if (title && title.length > 2 && title.length < 160) {
            watching.push({ title, source: 'AniWatch' });
          }
        });
      }

      return { watching, planned, completed };
    }

    const localData = readLocalStorage();
    const domData = scrapeDOM();

    const dedup = arr => {
      const seen = new Set();
      return arr.filter(item => {
        const key = item.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    // Merge localStorage + DOM, preferring DOM for watchlist pages
    results.watching = dedup([...domData.watching, ...localData.watching]).slice(0, 200);
    results.planned = dedup(domData.planned).slice(0, 200);
    results.completed = dedup(domData.completed).slice(0, 200);

    return {
      platform: 'AniWatch',
      counts: { watching: results.watching.length, planned: results.planned.length, completed: results.completed.length },
      data: results
    };
  };
})();
