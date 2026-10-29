# Banknote photographs

Only `banknotes.js`'s reviewed local snippets are used in the game. Original photographs are not a fallback and are not passed to the viewer. The zoom button receives the exact same cropped WebP as the evidence card.

The first reviewed set has seven country-specific fragments (RU, UA, BY, MD, CZ, BO, TJ) and a shared EUR specimen. This covers 32 countries in the current catalog. Remaining countries retain the text clue until their photograph is reviewed; most old euro-area photos were obsolete currencies or coins and must not be reused.

`data/banknotes.json` records source URLs, normalized crop bounds, source hashes and review date. BO and TJ use the respective central banks' images. Other originals are Wikimedia files. EUR keeps its specimen watermark; the EU flag is common to all euro users and does not identify the answer country. All seven country-specific fragments were visually checked for visible country names after cropping. Image recognition of a portrait or ornament is intentional gameplay.

Rebuild from downloaded source files (Pillow required):

```
python geo/tools/build_banknote_snippets.py output/banknote-source
```

If a source hash changes, do not silently rebuild: inspect the replacement and select a new safe crop. To add a country, download its actual banknote, inspect every visible inscription (including local scripts), add the reviewed crop to the manifest, generate the local file and add its country ID to `BANKNOTES`. Never add the uncropped original URL to `banknoteHTML` or the photo viewer.

Wikimedia returned HTTP 429 with Retry-After 600 during this pass; remaining unverified images were not enabled.
