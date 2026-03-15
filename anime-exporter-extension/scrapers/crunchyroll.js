// Crunchyroll scraper — reads queue, crunchylists, and history
(function() {
  window.__animeExporter_crunchyroll = async function() {
    const results = { watching: [], planned: [], completed: [] };

    function cleanTitle(el) {
      return el ? el.textContent.trim().replace(/\s+/g, ' ') : null;
    }

    // Crunchyroll exposes some store data
    function readCRStore() {
      const items = [];
      try {
        const store = window.__STORES__ || window.__CR_STORES__;
        if (!store) return items;
        const str = JSON.stringify(store);
        const re = /"(?:title|seriesTitle|name)"\s*:\s*"([^"]{2,100})"/g;
        const seen = new Set();
        let m;
        while ((m = re.exec(str)) !== null) {
          const title = m[1].trim();
          if (!title || seen.has(title) || title.startsWith('http')) continue;
          seen.add(title);
          items.push({ title, source: 'Crunchyroll' });
        }
      } catch(e) {}
      return items;
    }

    function scrapeDOM() {
      const watching = [];
      const planned = [];

      // Queue / Watchlist page
      const isQueue = window.location.pathname.includes('queue') || window.location.pathname.includes('watchlist');
      const isHistory = window.location.pathname.includes('history');

      // Card selectors for Crunchyroll
      const cardSelectors = [
        '.browse-card-title', '[class*="browse-card"] h4',
        '[class*="series-title"]', '[class*="SeriesTitle"]',
        '[data-testid*="title"]', '[class*="card-title"]',
        'h4[class*="title"]', '[class*="queue-item"] h4',
        '[class*="watchlist-item"] [class*="title"]',
        'a[title]'
      ];

      // Find containers
      const containers = document.querySelectorAll(
        '[class*="queue"], [class*="Queue"], [class*="watchlist"], [class*="history"], ' +
        '[class*="carousel"], [class*="Carousel"], [data-t="queue-section"]'
      );

      containers.forEach(container => {
        const header = container.querySelector('h2, h3, [class*="section-header"]');
        const headerText = header ? header.textContent.toLowerCase() : '';
        const isContinue = headerText.includes('continue') || headerText.includes('watching') || isHistory;
        const isWatchlist = headerText.includes('queue') || headerText.includes('watchlist') || isQueue;

        cardSelectors.forEach(sel => {
          container.querySelectorAll(sel).forEach(el => {
            const title = cleanTitle(el) || el.getAttribute('title');
            if (!title || title.length < 2 || title.length > 120) return;
            const item = { title, source: 'Crunchyroll' };
            if (isContinue) watching.push(item);
            else if (isWatchlist) planned.push(item);
            else watching.push(item);
          });
        });
      });

      // Broad fallback
      if (watching.length === 0) {
        cardSelectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            const title = cleanTitle(el) || el.getAttribute('title');
            if (title && title.length > 2 && title.length < 120) {
              watching.push({ title, source: 'Crunchyroll' });
            }
          });
        });
      }

      return { watching, planned };
    }

    const storeItems = readCRStore();
    const domResult = scrapeDOM();

    const dedup = arr => {
      const seen = new Set();
      return arr.filter(item => {
        const k = item.title.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
    };

    results.watching = dedup(storeItems.length > 5 ? storeItems : domResult.watching).slice(0, 200);
    results.planned = dedup(domResult.planned).slice(0, 200);

    return {
      platform: 'Crunchyroll',
      counts: { watching: results.watching.length, planned: results.planned.length, completed: 0 },
      data: results
    };
  };
})();
