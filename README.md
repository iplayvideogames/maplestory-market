# Maple Market — The Mesos Ledger

A public, read-only MapleStory Classic price history and trading dashboard.

**Website:** https://iplayvideogames.github.io/maplestory-market/

## Architecture

The published website is on the `master` branch:

- `index.html` — accessible semantic structure.
- `style.css` — responsive visual design.
- `app.js` — filtering, sales and asking-price comparison, item history charts, image fallbacks, and remote data reader.
- `prices.json` — retained bootstrap snapshot *only*; **not** the live source of truth.

The **live record of truth** is **`data:prices.json`**. Changes to the `data` branch do not update the `master` branch or trigger the branch-based GitHub Pages deployment. The website fetches `https://raw.githubusercontent.com/iplayvideogames/maplestory-market/data/prices.json` on load and checks again every 60 seconds.

GitHub's raw CDN and browser caching may delay visibility even though the page checks every minute; the refresh control requests a fresh version. If remote data is unavailable on initial load, the page falls back to the `master` snapshot and warns visitors.

**Publishing:** Repository Settings → Pages → Deploy from a branch → `master` / `/(root)`.

## Price record schema

Every `entries` array element in `data:prices.json` has:

- `id`: unique increasing observation identifier.
- `name`: original normalized price-ledger item name.
- `price`: *per-unit mesos* or `null` if no asking price was provided.
- `quantity`: number of units included in this observation.
- `status`: `sold` or `unsold`.
- `date`: recorded observation date (the initial chat history was recorded October 9, 2026).

The main displayed "average sold" is an *unweighted average of recorded completed-sale sightings*. The item detail also displays the unit-weighted average. **Unsold sightings are never included in sold-price averages.**

The `items` object can hold:

- `page`: verified MeowDB item page ID.
- `sprite`: known item sprite ID (external image).
- `canonical`: MeowDB canonical name, when verified.
- `aliases`: common abbreviations from voice/chat entries.
- `category`: one of `scroll`, `fashion`, `equipment`, `material`, or `other`.

### Updating from ChatGPT

Use the connected **iplayvideogames** GitHub account. Before writing, **fetch `prices.json` on the `data` branch**, append new entries (don't replace historical entries), assign the next ID, and update the file with its current SHA on **`data`**. Do not write prices to `master`. Confirm successful commit before responding "Added."

Match abbreviations/typos against saved aliases and verified MeowDB item names. Avoid automatic matches where multiple items could be intended; ask before merging those. Preserve full history and the sale/unsold distinction (`ww`, `bb`, and "unsold" all designate unsold).

Unpriced unsold notes should stay unpriced. The pending voice batch mentioning "Black Sunglasses, Angel Halo, Angel Wings, Angel Wand — 14k" has not been assigned to any specific items.

## Third-party sources

Item lookup and outbound links: https://meowdb.com/msclassic/item-db/all . External item sprites are optional and have fallbacks. Data prices are independently reported by the tracker owner; no external market prices are imported.

## Deployment

GitHub Pages redeploys when the site files on `master` change, but **not** for ordinary price commits to `data`. Visitors continue using the same address. No GitHub personal-access token is stored in the website.
