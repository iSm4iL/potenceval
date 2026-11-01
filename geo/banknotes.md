# Banknote photographs

## Rights review, 2026-10-30

“Reviewed” in the older manifest means visual crop review, **not legal clearance**.
Runtime EUR now uses `assets/banknotes/EUR-ecb-72dpi.jpg`, an unchanged 340×176 JPEG from the ECB's [official 72 dpi specimen archive](https://www.ecb.europa.eu/euro/shared/img/Banknotes%20ES2%20Specimen%2072dpi.zip), entry `Banknotes ES2 Specimen 72dpi/ES2 Specimen Lagarde Signature_jpg/ECB 5 Euro Specimen Front with Lagarde signature.jpg`.
SHA-256: `4b9b34aedd9e53ab8e8607d7e590b239c39b2fda614b8e57c122cd1355b0f657`.
Source and conditions: [ECB reproduction rules](https://www.ecb.europa.eu/euro/banknotes/images/html/index.en.html), checked 2026-10-30. No cropping, watermark removal or re-encoding. Card and viewer receive this same file. The common euro design does not identify a particular euro-area country.

The older 709×364 `EUR.webp` and its Commons manifest entry remain historical evidence; they are not the runtime image. Rebuilding the old snippets does not overwrite the official JPEG. For a €5 banknote (120×62 mm), 709 pixels exceeds the 72 dpi digital reproduction limit; retaining a specimen mark alone was insufficient.

The other seven assets have **not** been legally cleared. In particular, the Czech portrait lacks the inseparable specimen marking described for digital reproduction in Article 13(4) of [CNB Decree 274/2011](https://www.cnb.cz/export/sites/cnb/en/legislation/.galleries/decrees/decree_274_2011.pdf). Its small crop is not evidence that rules for tangible partial reproductions apply to a website. See `launch-review.md` for outstanding checks; no disputed asset was deleted automatically.

## Earlier visual crop review (2026-10-28)

Only `banknotes.js`'s reviewed local snippets are used in the game. Original photographs are not a fallback and are not passed to the viewer. The zoom button receives the exact same cropped WebP as the evidence card.

The first reviewed set has seven country-specific fragments (RU, UA, BY, MD, CZ, BO, TJ) and a shared EUR specimen. This covers 32 countries in the current catalog. Remaining countries retain the text clue until their photograph is reviewed; most old euro-area photos were obsolete currencies or coins and must not be reused.

`data/banknotes.json` records source URLs, normalized crop bounds, source hashes and review date. BO and TJ use the respective central banks' images. Other originals are Wikimedia files. EUR keeps its specimen watermark; the EU flag is common to all euro users and does not identify the answer country. All seven country-specific fragments were visually checked for visible country names after cropping. Image recognition of a portrait or ornament is intentional gameplay.

Rebuild from downloaded source files (Pillow required):

```
python geo/tools/build_banknote_snippets.py output/banknote-source
```

If a source hash changes, do not silently rebuild: inspect the replacement and select a new safe crop. To add a country, download its actual banknote, inspect every visible inscription (including local scripts), add the reviewed crop to the manifest, generate the local file and add its country ID to `BANKNOTES`. Never add the uncropped original URL to `banknoteHTML` or the photo viewer.

Wikimedia returned HTTP 429 with Retry-After 600 during this pass; remaining unverified images were not enabled.
