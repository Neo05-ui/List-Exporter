# List Exporter

> Extract your watchlist from streaming platforms and save it anywhere — no more typing 200 titles by hand.

A Chrome extension that reads your watching, planned, and completed lists directly from streaming sites while you're logged in, then exports them to **Notion**, **plain text**, **CSV**, or **Markdown** (Obsidian-ready).

---

## Supported Platforms

| Platform | Watchlist | Continue Watching | Status Sorting |
|---|---|---|---|
| Netflix | ✅ | ✅ | — |
| Amazon Prime Video | ✅ | ✅ | — |
| Disney+ | ✅ | ✅ | — |
| Hotstar | ✅ | ✅ | — |
| AniWatch | ✅ | ✅ | ✅ Watching / Planned / Completed |
| Crunchyroll | ✅ | ✅ | — |

---

## Export Formats

- **Notion** — pushes directly to a Notion database via API
- **TXT** — plain text file, grouped by status
- **CSV** — spreadsheet-ready, opens in Excel / Google Sheets
- **Markdown** — checkbox format, works perfectly with Obsidian

---

## Installation

> The extension is not yet on the Chrome Web Store. Install it manually in under a minute.

**1. Download**

Click the green **Code** button on this page → **Download ZIP** → unzip the folder anywhere on your computer.

**2. Open Chrome Extensions**

Go to `chrome://extensions` in your browser address bar.

**3. Enable Developer Mode**

Toggle **Developer mode** on in the top-right corner.

**4. Load the extension**

Click **Load unpacked** → select the unzipped `list-exporter` folder.

Done. The **LIST.EXPORTER** icon appears in your Chrome toolbar.

---

## How to Use

1. **Open the streaming site** you want to scrape (e.g. Netflix, AniWatch) and make sure you're logged in
2. **Navigate to your watchlist page** on that site
3. **Click the extension icon** in your toolbar
4. **Select the platform** from the grid
5. **Click SCAN CURRENT PAGE**
6. Your titles appear sorted by status — then pick your export format

### For AniWatch specifically
Go to `aniwatch.to/watchlist` (you must be logged in). The scraper reads all status categories — Watching, Plan to Watch, Completed, On Hold, and Dropped — in one scan.

### For Netflix / Prime / Disney+ / Hotstar
Navigate to your home page or watchlist/my-stuff section so titles are visible on screen. Scroll down a bit to load more cards before scanning for best results.

---

## Notion Export Setup

To push to Notion you need two things:

**1. Create an Integration**
- Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
- Click **New integration** → give it a name → click Submit
- Copy the **Integration Token** (starts with `secret_`)

**2. Get your Database ID**
- Open your Notion database in the browser
- The URL looks like: `https://notion.so/yourworkspace/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`
- The 32-character string between the last `/` and `?` is your Database ID

**3. Connect the integration to your database**
- Open the Notion database → click `...` (top right) → **Connections** → add your integration

**4. Set up the database columns**
For best results, create these properties in your Notion database:

| Property Name | Type |
|---|---|
| Name | Title |
| Status | Select |
| Platform | Select |
| Progress | Text |

---

## Why a Browser Extension?

Streaming platforms like Netflix and Prime Video block cross-origin requests — meaning no website can fetch your personal watchlist on your behalf. A browser extension runs *inside* your browser, on the same page you're already logged into, so it can read what's on screen without needing your password or bypassing any security.

---

## Privacy

- **No data leaves your browser** except when you explicitly click "Push to Notion" (which goes directly to Notion's API)
- **No accounts, no servers, no tracking** — the extension is entirely local
- Notion credentials are stored only in your browser's local extension storage and never transmitted anywhere else

---

## Project Structure

```
list-exporter/
├── manifest.json          # Extension config and permissions
├── popup.html             # Extension UI
├── popup.js               # UI logic and scraper orchestration
├── background.js          # Notion API push handler
└── scrapers/
    ├── netflix.js         # Netflix scraper
    ├── prime.js           # Prime Video scraper
    ├── hotstar.js         # Hotstar + Disney+ scraper
    ├── aniwatch.js        # AniWatch scraper
    └── crunchyroll.js     # Crunchyroll scraper
```

---

## Contributing

Pull requests are welcome. If a platform's layout has changed and the scraper stops working, the fix is usually in the relevant file under `scrapers/`. Each scraper exposes a single `window.__animeExporter_*` function that returns `{ platform, data: { watching, planned, completed } }`.

To add a new platform:
1. Create `scrapers/yourplatform.js` following the same pattern
2. Add the domain to `host_permissions` in `manifest.json`
3. Add the platform to `PLATFORMS` in `popup.js`
4. Add a button in the platform grid in `popup.html`

---

## Known Limitations

- **AniWatch** status sorting relies on the page's DOM structure — if they redesign the site it may need updating
- **Netflix** and **Prime** don't have a dedicated "completed" list, so everything shows under Watching
- Some platforms load content dynamically — if you get fewer results than expected, scroll the page to load more cards before scanning

---

## License

MIT — free to use, modify, and distribute.
