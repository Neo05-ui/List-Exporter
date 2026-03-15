'use strict';

const PLATFORMS = {
  netflix:    { name: 'Netflix',      domain: ['netflix.com'],                      fn: '__animeExporter_netflix' },
  prime:      { name: 'Prime Video',  domain: ['primevideo.com', 'amazon.com'],     fn: '__animeExporter_prime' },
  hotstar:    { name: 'Hotstar',      domain: ['hotstar.com'],                      fn: '__animeExporter_hotstar' },
  disney:     { name: 'Disney+',      domain: ['disneyplus.com'],                   fn: '__animeExporter_hotstar' },
  aniwatch:   { name: 'AniWatch',     domain: ['aniwatch.to','aniwatchtv.to','aniwave.to'], fn: '__animeExporter_aniwatch' },
  crunchyroll:{ name: 'Crunchyroll',  domain: ['crunchyroll.com'],                  fn: '__animeExporter_crunchyroll' },
};

const INSTRUCTIONS = {
  netflix:    'Go to <b>netflix.com</b> → Home or My List page, then click SCAN.',
  prime:      'Go to <b>primevideo.com</b> → Your Watchlist page, then click SCAN.',
  hotstar:    'Go to <b>hotstar.com</b> → My Stuff or continue watching, then click SCAN.',
  disney:     'Go to <b>disneyplus.com</b> → Watchlist or home, then click SCAN.',
  aniwatch:   'Go to <b>aniwatch.to</b> → your Watchlist page (must be logged in), then click SCAN.',
  crunchyroll:'Go to <b>crunchyroll.com</b> → Queue or Crunchylists page, then click SCAN.',
};

let currentPlatform = 'netflix';
let currentTab = 'watching';
let scrapedData = { watching: [], planned: [], completed: [] };
let platformName = 'Netflix';

// ── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadCached();
  bindEvents();
  updateInstruction();
});

function bindEvents() {
  // Platform buttons
  document.getElementById('plat-grid').addEventListener('click', e => {
    const btn = e.target.closest('.plat-btn');
    if (!btn || btn.classList.contains('disabled')) return;
    document.querySelectorAll('.plat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPlatform = btn.dataset.platform;
    platformName = PLATFORMS[currentPlatform]?.name || currentPlatform;
    hideError();
    updateInstruction();
  });

  // Scan button
  document.getElementById('btn-scan').addEventListener('click', doScan);

  // List tabs
  document.getElementById('tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderList(btn.dataset.tab);
  });

  // Export buttons
  document.getElementById('btn-notion').addEventListener('click', () => openModal());
  document.getElementById('btn-txt').addEventListener('click', exportTxt);
  document.getElementById('btn-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-md').addEventListener('click', exportMD);

  // Settings
  document.getElementById('btn-settings').addEventListener('click', toggleSettings);
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

  // Clear
  document.getElementById('btn-clear').addEventListener('click', clearData);

  // Modal
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-push').addEventListener('click', pushToNotion);
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────

function loadSettings() {
  chrome.storage.local.get('settings', data => {
    const s = data.settings || {};
    if (s.notionToken) document.getElementById('saved-token').value = s.notionToken;
    if (s.notionDb) document.getElementById('saved-db').value = s.notionDb;
  });
}

function saveSettings() {
  const token = document.getElementById('saved-token').value.trim();
  const db = document.getElementById('saved-db').value.trim();
  chrome.storage.local.set({ settings: { notionToken: token, notionDb: db } }, () => {
    toast('Settings saved');
    toggleSettings();
  });
}

function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  const content = document.getElementById('main-content');
  const isOpen = panel.classList.toggle('on');
  content.style.display = isOpen ? 'none' : 'block';
}

// ── CACHED DATA ───────────────────────────────────────────────────────────────

function loadCached() {
  chrome.storage.local.get('cachedLists', data => {
    const cached = data.cachedLists;
    if (cached && cached.platform && cached.data) {
      scrapedData = cached.data;
      platformName = cached.platform;
      showResults();
      setFooter(`Cached data from ${cached.platform}`);
    }
  });
}

function clearData() {
  scrapedData = { watching: [], planned: [], completed: [] };
  chrome.storage.local.remove('cachedLists');
  document.getElementById('results').classList.remove('on');
  setFooter('ready');
  toast('Data cleared');
}

// ── SCAN ──────────────────────────────────────────────────────────────────────

async function doScan() {
  const plat = PLATFORMS[currentPlatform];
  if (!plat) return;

  const btn = document.getElementById('btn-scan');
  const scanText = document.getElementById('scan-text');
  const scanIcon = document.getElementById('scan-icon');
  btn.disabled = true;
  scanText.textContent = 'SCANNING...';
  scanIcon.textContent = '[...]';
  hideError();
  showLoad('Checking active tab...', 15);

  try {
    // Get current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.url) {
      showError('No active tab found. Make sure the streaming site is open.');
      return resetScan();
    }

    // Check we're on the right domain
    const onRightDomain = plat.domain.some(d => tab.url.includes(d));
    if (!onRightDomain) {
      showError(`Please open ${plat.name} in this browser window first, then click SCAN.`);
      return resetScan();
    }

    showLoad('Injecting scraper...', 40);

    const fileMap = {
      netflix: 'scrapers/netflix.js',
      prime: 'scrapers/prime.js',
      hotstar: 'scrapers/hotstar.js',
      disney: 'scrapers/hotstar.js',
      aniwatch: 'scrapers/aniwatch.js',
      crunchyroll: 'scrapers/crunchyroll.js',
    };
    const scraperFile = fileMap[currentPlatform];

    // Step 1: inject the scraper file (registers the window function, no eval needed)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [scraperFile]
      });
    } catch(e) {
      showError('Could not inject scraper: ' + e.message);
      return resetScan();
    }

    showLoad('Running scraper...', 65);

    // Step 2: call the now-registered window function
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (fnName) => {
        try {
          if (typeof window[fnName] !== 'function') {
            return { error: 'Scraper function not found — try reloading the page and scanning again.' };
          }
          return await window[fnName]();
        } catch(e) {
          return { error: e.message || 'Scraper threw an error' };
        }
      },
      args: [plat.fn]
    });

    showLoad('Processing results...', 85);

    const result = results?.[0]?.result;
    if (!result) {
      showError('No data returned. Try scrolling the page to load content, then scan again.');
      return resetScan();
    }
    if (result.error) {
      showError(result.error);
      return resetScan();
    }

    scrapedData = result.data || { watching: [], planned: [], completed: [] };
    platformName = result.platform || platformName;

    // Cache it
    chrome.storage.local.set({ cachedLists: { platform: platformName, data: scrapedData } });

    await sleep(300);
    hideLoad();
    showResults();
    setFooter(`Scanned from ${platformName}`);

  } catch(err) {
    showError('Error: ' + (err.message || String(err)));
  }

  resetScan();
}



function resetScan() {
  const btn = document.getElementById('btn-scan');
  document.getElementById('scan-text').textContent = 'SCAN CURRENT PAGE';
  document.getElementById('scan-icon').textContent = '[■]';
  btn.disabled = false;
  hideLoad();
}

// ── RESULTS ───────────────────────────────────────────────────────────────────

function showResults() {
  document.getElementById('sw').textContent = scrapedData.watching?.length || 0;
  document.getElementById('sp').textContent = scrapedData.planned?.length || 0;
  document.getElementById('sc').textContent = scrapedData.completed?.length || 0;
  document.getElementById('results').classList.add('on');
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  renderList('watching');
}

function renderList(tab) {
  currentTab = tab;
  const el = document.getElementById('anime-list');
  const items = scrapedData[tab] || [];
  if (!items.length) {
    el.innerHTML = '<div class="empty">no titles in this category</div>';
    return;
  }
  const colors = { watching: '#00ff41', planned: '#ffb000', completed: '#00f0ff' };
  const c = colors[tab] || '#00ff41';
  el.innerHTML = items.map(item => `
    <div class="a-row">
      <div class="a-dot" style="background:${c};box-shadow:0 0 4px ${c}"></div>
      <div class="a-title" title="${esc(item.title)}">${esc(item.title)}</div>
      ${item.progress ? `<div class="a-meta">${esc(String(item.progress))}</div>` : ''}
    </div>
  `).join('');
}

// ── EXPORT ────────────────────────────────────────────────────────────────────

function allEntries() {
  return [
    ...(scrapedData.watching || []).map(e => ({ ...e, status: 'Watching' })),
    ...(scrapedData.planned || []).map(e => ({ ...e, status: 'Plan to Watch' })),
    ...(scrapedData.completed || []).map(e => ({ ...e, status: 'Completed' })),
  ];
}

function exportTxt() {
  const lines = [`=== ${platformName.toUpperCase()} WATCHLIST ===`, `Exported: ${new Date().toLocaleDateString()}`, '', '-- WATCHING --'];
  (scrapedData.watching || []).forEach((e, i) => lines.push(`${i+1}. ${e.title}${e.progress ? '  ['+e.progress+']' : ''}`));
  lines.push('', '-- PLAN TO WATCH --');
  (scrapedData.planned || []).forEach((e, i) => lines.push(`${i+1}. ${e.title}`));
  lines.push('', '-- COMPLETED --');
  (scrapedData.completed || []).forEach((e, i) => lines.push(`${i+1}. ${e.title}`));
  dlFile(`${platformName.toLowerCase().replace(/\s+/g,'-')}-list.txt`, lines.join('\n'));
  toast('TXT downloaded');
}

function exportCSV() {
  const rows = [['Title', 'Status', 'Progress', 'Platform']];
  allEntries().forEach(e => rows.push([
    `"${(e.title || '').replace(/"/g, '""')}"`,
    e.status, e.progress || '', e.source || platformName
  ]));
  dlFile(`${platformName.toLowerCase().replace(/\s+/g,'-')}-list.csv`, rows.map(r => r.join(',')).join('\n'));
  toast('CSV downloaded');
}

function exportMD() {
  const lines = [`# ${platformName} Watchlist`, `*${new Date().toLocaleDateString()}*`, '', '## Watching', ''];
  (scrapedData.watching || []).forEach(e => lines.push(`- [ ] **${e.title}**${e.progress ? ' — '+e.progress : ''}`));
  lines.push('', '## Plan to Watch', '');
  (scrapedData.planned || []).forEach(e => lines.push(`- [ ] ${e.title}`));
  lines.push('', '## Completed', '');
  (scrapedData.completed || []).forEach(e => lines.push(`- [x] ${e.title}`));
  dlFile(`${platformName.toLowerCase().replace(/\s+/g,'-')}-list.md`, lines.join('\n'));
  toast('Markdown downloaded');
}

function dlFile(name, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── NOTION ────────────────────────────────────────────────────────────────────

function openModal() {
  // Pre-fill saved creds
  chrome.storage.local.get('settings', data => {
    const s = data.settings || {};
    if (s.notionToken) document.getElementById('notion-token').value = s.notionToken;
    if (s.notionDb) document.getElementById('notion-db').value = s.notionDb;
  });
  document.getElementById('notion-modal').classList.add('on');
}

function closeModal() {
  document.getElementById('notion-modal').classList.remove('on');
}

async function pushToNotion() {
  const token = document.getElementById('notion-token').value.trim();
  const dbId = document.getElementById('notion-db').value.trim().replace(/-/g, '');
  if (!token || !dbId) { toast('Fill in both fields'); return; }

  if (document.getElementById('save-creds').checked) {
    chrome.storage.local.set({ settings: { notionToken: token, notionDb: dbId } });
  }

  const btn = document.getElementById('btn-push');
  btn.textContent = 'PUSHING...';
  btn.disabled = true;

  const items = allEntries();
  let ok = 0, fail = 0;

  for (const item of items) {
    try {
      const r = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            Name: { title: [{ text: { content: item.title || 'Unknown' } }] },
            Status: { select: { name: item.status || 'Watching' } },
            Platform: { select: { name: item.source || platformName } },
            ...(item.progress ? { Progress: { rich_text: [{ text: { content: String(item.progress) } }] } } : {})
          }
        })
      });
      r.ok ? ok++ : fail++;
    } catch { fail++; }
    await sleep(80);
  }

  btn.textContent = 'PUSH >>';
  btn.disabled = false;
  closeModal();
  toast(`Pushed ${ok}${fail ? `, ${fail} failed` : ''}`);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function updateInstruction() {
  const box = document.getElementById('inst-box');
  const txt = INSTRUCTIONS[currentPlatform];
  if (txt) { box.innerHTML = txt; box.classList.add('on'); }
  else box.classList.remove('on');
}

function showLoad(msg, pct) {
  document.getElementById('load').classList.add('on');
  document.getElementById('load-msg').textContent = msg;
  document.getElementById('load-fill').style.width = pct + '%';
}

function hideLoad() { document.getElementById('load').classList.remove('on'); }

function showError(msg) {
  const el = document.getElementById('err-box');
  el.textContent = msg;
  el.classList.add('on');
}

function hideError() { document.getElementById('err-box').classList.remove('on'); }

function setFooter(msg) { document.getElementById('ftr-txt').textContent = msg; }

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 3000);
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
