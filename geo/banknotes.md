# Banknote photographs

## Images shown in the game, 2026-11-07

All 53 displayed currency clues have an image. The euro still uses the unchanged ECB file documented below. Sterling uses a 122×166 fragment of the reverse of the Bank of England's £20 polymer banknote. It shows Turner's ship motif and contains no country name, issuer name, emblem, serial number or readable text. The [Bank of England's image listing](https://www.flickr.com/photos/bankofengland/48874740572/in/album-72157662787666013) allows public use subject to the [bank's reproduction conditions](https://www.bankofengland.co.uk/banknotes/using-images-of-banknotes). The crop represents about 15% of the side and qualifies under the bank's condition 5(c) for showing less than half of a side digitally. The image is shown as an unretouched fragment. The manifest records the exact crop and source hash.

The other 51 clue labels use original geometric tokens, visibly labeled as game illustrations. The token's color and mark depend only on the clue text. Shared labels like “dollar” therefore receive the same art, and the token contains no country identifier or element of a real banknote. The seven older crops remain on disk for the historical rights review, with game rendering switched to original tokens for those currencies.

## Rights review, 2026-10-30

“Reviewed” in the older manifest means visual crop review, **not legal clearance**.
Runtime EUR now uses `assets/banknotes/EUR-ecb-72dpi.jpg`, an unchanged 340×176 JPEG from the ECB's [official 72 dpi specimen archive](https://www.ecb.europa.eu/euro/shared/img/Banknotes%20ES2%20Specimen%2072dpi.zip), entry `Banknotes ES2 Specimen 72dpi/ES2 Specimen Lagarde Signature_jpg/ECB 5 Euro Specimen Front with Lagarde signature.jpg`.
SHA-256: `4b9b34aedd9e53ab8e8607d7e590b239c39b2fda614b8e57c122cd1355b0f657`.
Source and conditions: [ECB reproduction rules](https://www.ecb.europa.eu/euro/banknotes/images/html/index.en.html), checked 2026-10-30. No cropping, watermark removal or re-encoding. Card and viewer receive this same file. The common euro design does not identify a particular euro-area country.

The older 709×364 `EUR.webp` and its Commons manifest entry remain historical evidence; they are not the runtime image. Rebuilding the old snippets does not overwrite the official JPEG. For a €5 banknote (120×62 mm), 709 pixels exceeds the 72 dpi digital reproduction limit; retaining a specimen mark alone was insufficient.

The other seven assets have **not** been legally cleared. In particular, the Czech portrait lacks the inseparable specimen marking described for digital reproduction in Article 13(4) of [CNB Decree 274/2011](https://www.cnb.cz/export/sites/cnb/en/legislation/.galleries/decrees/decree_274_2011.pdf). Its small crop is not evidence that rules for tangible partial reproductions apply to a website. See `launch-review.md` for outstanding checks; no disputed asset was deleted automatically.

## Earlier visual crop review (2026-10-28)

At the time, only `banknotes.js`'s visually reviewed local snippets were used in the game. The card and the viewer use the same local asset.

The first reviewed set has seven country-specific fragments (RU, UA, BY, MD, CZ, BO, TJ) and a shared EUR specimen. This covers 32 countries in the current catalog. Remaining countries retain the text clue until their photograph is reviewed; most old euro-area photos were obsolete currencies or coins and must not be reused.

`data/banknotes.json` records source URLs, normalized crop bounds, source hashes and review date. BO and TJ use the respective central banks' images. Other originals are Wikimedia files. EUR keeps its specimen watermark; the EU flag is common to all euro users and does not identify the answer country. All seven country-specific fragments were visually checked for visible country names after cropping. Image recognition of a portrait or ornament is intentional gameplay.

Rebuild from downloaded source files (Pillow required):

```
python geo/tools/build_banknote_snippets.py output/banknote-source
```

If a source hash changes, inspect the replacement and select a new safe crop before rebuilding. Before adding a real crop, check the image rights and current reproduction conditions, inspect every visible inscription (including local scripts), add the reviewed crop to the manifest and generate the local file. Register it in `CROPS` only for a clue label that can use the image without revealing any extra country-specific detail. The card and viewer should use the reviewed file.

Wikimedia returned HTTP 429 with Retry-After 600 during this pass; remaining unverified images were not enabled.
