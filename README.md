# MapleStory Market

A shareable, read-only MapleStory Classic market dashboard tracking observed sold prices and unsold asking prices in mesos.

## Publish on GitHub Pages

1. For a public, freely accessible site, ensure the repository is public (Settings → General → Danger Zone → Change repository visibility).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **master** and directory **/(root)**, then **Save**.
5. The expected address is **https://oobohp.github.io/maplestory-market/** once GitHub Pages finishes deploying.

## Updating prices

The dashboard reads `prices.json` on page load and rechecks it every 60 seconds. Updating the file on the `master` branch triggers a new GitHub Pages deployment automatically. The public URL stays the same.

Price history is maintained in `prices.json`:

- `status: "sold"`: counts toward sold-price averages and sale trends.
- `status: "unsold"`: tracked separately; never included in sold-price averages.
- `price`: unit price in mesos, or `null` if the asking price wasn't provided.
- `quantity`: number of units at the stated unit price.
- `date`: date observed. `id`: stable observation ID.

The dashboard's main averages are per distinct sold observation. Item details also show quantity-weighted sold averages. MeowDB item links and sprite IDs are stored in `prices.json` under `items`. If a sprite cannot load, the dashboard tries an alternate source and then displays a category icon.

For updates from ChatGPT, provide item entries in the connected chat. ChatGPT should fetch the latest `prices.json`, append unique new observations, then update that file through the connected GitHub integration. Do not replace the historical dataset with only the latest session's observations.

Unpriced items and ambiguous voice entries remain in the dataset or pending list for clarification.
