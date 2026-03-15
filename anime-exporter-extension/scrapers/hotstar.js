// Disney+ / Hotstar scraper
(function() {
  const isHotstar = window.location.hostname.includes('hotstar');

  window.__animeExporter_hotstar = async function() {
    const results = { watching: [], planned: [], completed: [] };

    function cleanTitle(el) {
      return el ? el.textContent.trim().replace(/\s+/g, ' ') : null;
    }

    // Strategy 1: Hotstar exposes window.__INITIAL_STATE__ with a content catalog
    function readHotstarState() {
      const items = { watching: [], planned: [] };
      try {
        const state = window.__INITIAL_STATE__ || window.__hotstar || window.__STATE__;
        if (!state) return items;
        const str = JSON.stringify(state);

        // Hotstar stores titles under "title" and "contentTitle" keys
        const seen = new Set();
        const titleRe = /"(?:title|contentTitle|showName)"\s*:\s*"([^"]{2,100})"/g;
        let m;
        while ((m = titleRe.exec(str)) !== null) {
          const title = m[1].trim();
          if (!title || seen.has(title) || title.startsWith('http')) continue;
          seen.add(title);
          items.watching.push({ title, source: isHotstar ? 'Hotstar' : 'Disney+' });
        }
      } catch(e) {}
      return items;
    }

    // Strategy 2: Disney+ stores data in a __SSR_PROPS__ or similar window var
    function readDisneyState() {
      const items = [];
      try {
        const props = window.__SSR_PROPS__ || window.__PRELOADED_STATE__ || window.disneyPlusData;
        if (!props) return items;
        const str = JSON.stringify(props);
        const seen = new Set();
        const re = /"(?:title|name|seriesName)"\s*:\s*"([^"]{2,100})"/g;
        let m;
        while ((m = re.exec(str)) !== null) {
          const title = m[1].trim();
          if (!title || seen.has(title)) continue;
          seen.add(title);
          items.push({ title, source: 'Disney+' });
        }
      } catch(e) {}
      return items;
    }

    // Strategy 3: DOM scraping — works for both
    function scrapeDOM() {
      const watching = [];
      const planned = [];
      const source = isHotstar ? 'Hotstar' : 'Disney+';

      // Common selectors for both platforms
      const cardSelectors = [
        '[class*="card-title"]', '[class*="CardTitle"]', '[class*="content-title"]',
        '[data-testid*="title"]', '[class*="title-text"]', '[class*="TitleText"]',
        '[class*="tray-item"] span', '[class*="TrayItem"] span',
        '[class*="watchlist"] [class*="title"]',
        // Hotstar specific
        '[class*="storyboard-card"] p', '[class*="story-card"] p',
        // Disney+ specific
        '[class*="ContinueWatchingCard"] span', '[class*="StandardCard"] span'
      ];

      // Find continue watching and watchlist containers
      const containers = document.querySelectorAll(
        '[class*="continue"], [class*="Continue"], [class*="watchlist"], [class*="Watchlist"], ' +
        '[data-testid*="continue"], [data-testid*="watchlist"], ' +
        '[class*="tray"], [class*="Tray"], [class*="carousel"]'
      );

      containers.forEach(container => {
        const headerEl = container.querySelector('h2, h3, [class*="header"], [class*="tray-title"]');
        const headerText = headerEl ? headerEl.textContent.toLowerCase() : '';
        const isContinue = headerText.includes('continue') || headerText.includes('resume') || headerText.includes('watching');
        const isWatchlist = headerText.includes('watchlist') || headerText.includes('saved');

        cardSelectors.forEach(sel => {
          container.querySelectorAll(sel).forEach(el => {
            const title = cleanTitle(el);
            if (!title || title.length < 2 || title.length > 120) return;
            const item = { title, source };
            if (isWatchlist) planned.push(item);
            else watching.push(item);
          });
        });
      });

      // Broad sweep if nothing found
      if (watching.length === 0) {
        cardSelectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            const title = cleanTitle(el);
            if (title && title.length > 2 && title.length < 120) {
              watching.push({ title, source });
            }
          });
        });
      }

      return { watching, planned };
    }

    const stateResult = isHotstar ? readHotstarState() : { watching: readDisneyState(), planned: [] };
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

    const stateWatching = Array.isArray(stateResult.watching) ? stateResult.watching : [];

    if (stateWatching.length > 5) {
      results.watching = dedup(stateWatching).slice(0, 200);
      results.planned = dedup(stateResult.planned || []).slice(0, 200);
    } else {
      results.watching = dedup(domResult.watching).slice(0, 200);
      results.planned = dedup(domResult.planned).slice(0, 200);
    }

    return {
      platform: isHotstar ? 'Hotstar' : 'Disney+',
      counts: { watching: results.watching.length, planned: results.planned.length, completed: 0 },
      data: results
    };
  };
})();
