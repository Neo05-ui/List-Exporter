'use strict';

// Background service worker
// Scraping is now done directly in popup.js via chrome.scripting.executeScript
// Background handles only: Notion API push (needs fetch outside popup CSP), storage

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NOTION_PUSH') {
    pushToNotion(message.items, message.token, message.dbId).then(sendResponse);
    return true;
  }
});

async function pushToNotion(items, token, dbId) {
  let success = 0, fail = 0;
  const clean = dbId.replace(/-/g, '');

  for (const item of items) {
    try {
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          parent: { database_id: clean },
          properties: {
            Name: { title: [{ text: { content: item.title || 'Unknown' } }] },
            Status: { select: { name: item.status || 'Watching' } },
            Platform: { select: { name: item.source || '' } },
            ...(item.progress ? { Progress: { rich_text: [{ text: { content: String(item.progress) } }] } } : {})
          }
        })
      });
      resp.ok ? success++ : fail++;
    } catch { fail++; }
    await new Promise(r => setTimeout(r, 80));
  }

  return { success, fail };
}
