// Prime Video scraper — reads Watchlist and Continue Watching
(function() {
  window.__animeExporter_prime = async function() {
    const results = { watching: [], planned: [], completed: [] };

    function cleanTitle(el) {
      return el ? el.textContent.trim().replace(/\s+/g, ' ') : null;
    }

    // Strategy 1: Prime's internal state — they store data in window.__INITIAL_STATE__ or similar
    function readInitialState() {
      const items = [];
      try {
        // Prime Video sometimes exposes window.ue_id or catalog data
        const stateKeys = ['__INITIAL_STATE__', '__PRELOADED_STATE__', 'ue_sn'];
        for (const key of stateKeys) {
          if (window[key]) {
            const str = JSON.stringify(window[key]);
            // Extract title patterns from JSON blob
            const titleMatches = str.match(/"title"\s*:\s*"([^"]{2,80})"/g) || [];
            titleMatches.slice(0, 100).forEach(m => {
              const title = m.replace(/"title"\s*:\s*"/, '').replace(/"$/, '');
              if (title && !title.startsWith('http') && title.length > 2) {
                items.push({ title, source: 'Prime Video' });
              }
            });
          }
        }
      } catch(e) {}
      return items;
    }

    // Strategy 2: DOM scraping
    function scrapeDOM() {
      const watching = [];
      const planned = [];

      // Continue watching carousels
      const carousels = document.querySelectorAll('[data-testid*="carousel"], [class*="carousel"], [class*="Carousel"], [data-automationid*="grid"]');

      carousels.forEach(carousel => {
        const header = carousel.querySelector('h2, h3, [class*="heading"], [class*="Header"], [data-testid*="header"]');
        const headerText = header ? header.textContent.toLowerCase() : '';
        const isContinue = headerText.includes('continue') || headerText.includes('watching') || headerText.includes('resume');
        const isWatchlist = headerText.includes('watchlist') || headerText.includes('watch list');

        const titleEls = carousel.querySelectorAll(
          '[data-testid*="title"], [class*="title"], [aria-label*="title"], ' +
          '[class*="TitleCard"] span, [class*="titleCard"] span, ' +
          'h3 span, [class*="card"] [class*="text"]'
        );

        titleEls.forEach(el => {
          const title = cleanTitle(el);
          if (!title || title.length < 2 || title.length > 100) return;
          if (/^\d+$/.test(title)) return; // skip pure numbers

          const item = { title, source: 'Prime Video' };
          if (isContinue) watching.push(item);
          else if (isWatchlist) planned.push(item);
          else if (!header) watching.push(item); // uncategorized cards = likely visible/browsed
        });
      });

      // Broad sweep: all visible title text elements
      if (watching.length === 0) {
        document.querySelectorAll('[data-testid="title"], [class*="DmTitleCard"] span, [class*="av-card"] [class*="title"]').forEach(el => {
          const title = cleanTitle(el);
          if (title && title.length > 2 && title.length < 100) {
            watching.push({ title, source: 'Prime Video' });
          }
        });
      }

      // My Stuff / Watchlist page detection
      if (window.location.pathname.includes('watchlist') || window.location.pathname.includes('my-stuff')) {
        document.querySelectorAll('[class*="card"], [class*="Card"]').forEach(card => {
          const titleEl = card.querySelector('h2, h3, [class*="title"], span');
          const title = cleanTitle(titleEl);
          if (title && title.length > 2) planned.push({ title, source: 'Prime Video' });
        });
      }

      return { watching, planned };
    }

    const stateItems = readInitialState();
    const domResult = scrapeDOM();

    const dedup = arr => {
      const seen = new Set();
      return arr.filter(item => {
        const key = item.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    if (stateItems.length > 5) {
      results.watching = dedup(stateItems).slice(0, 200);
    } else {
      results.watching = dedup(domResult.watching).slice(0, 200);
      results.planned = dedup(domResult.planned).slice(0, 200);
    }

    return {
      platform: 'Prime Video',
      counts: { watching: results.watching.length, planned: results.planned.length, completed: 0 },
      data: results
    };
  };
})();
