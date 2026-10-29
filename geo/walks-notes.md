# Walk start investigation — 2026-10-28

## Result and coverage

- Removed only `WALKS.NA[1]`, `[6.904891, 79.867452]`, in Colombo, Sri Lanka. Retained the existing Windhoek start `[-22.567665, 17.087549]`. No replacement coordinates were guessed.
- `WALKS` retains its ISO → nonempty arrays of `[lat, lng]` contract. Namibia now has one start; the existing app hides “other place” when there is only one. All other country data is unchanged.
- No `WALK_PANOS` export: **zero verified official outdoor panorama IDs**. No visual verification of outdoor imagery or navigation links was achieved for any start. This fixes the wrong-country destination, not the tunnel/balcony selection problem.
- Endpoint discovery used one existing start, France `48.858908,2.293295`; it does not establish coverage elsewhere. Coordinate structure tests cover every retained start, not country membership or imagery quality.
- Retained dataset: 102 countries, 259 starts (previously 260). Comparison against `HEAD:geo/walks.js` confirmed that deleting the Colombo point is the only coordinate change.

## Observed Google responses

Read-only HTTPS requests made without an API key:

1. `https://maps.googleapis.com/maps/api/streetview/metadata?location=48.858908,2.293295&source=outdoor`: HTTP 200, JSON `status: REQUEST_DENIED`, message requiring an API key. HTTP success does not mean imagery exists.
2. `https://maps.google.com/cbk?output=json&ll=48.858908,2.293295`: HTTP 404.
3. `https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch` with callback and coordinate-search `pb`: returned `GeoPhotoService.SingleImageSearch is decommissioned and turned down.`
4. `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=48.858908,2.293295`: HTTP 200 HTML application shell. Inspection found coordinate initialization and photometa endpoint references, but no substantiated resolved panorama ID, Google imagery attribution, outdoor scene or linked street navigation. Embedded page credentials were not reused. The photometa endpoints themselves were not exercised.

Initial restricted-shell DNS attempts failed; the observations above came from subsequent successful network-enabled requests. The web reader could not open these endpoint URLs. These results constrain this investigation; they do not prove all keyless discovery methods are impossible.

Google's [metadata documentation](https://developers.google.com/maps/documentation/streetview/metadata) requires a key and warns that panorama IDs can change. [Maps URLs documentation](https://developers.google.com/maps/documentation/urls/get-started#street-view-action) permits keyless panorama links, but coordinate viewpoints choose nearby imagery and can change as imagery is refreshed. Neither an OSM road point nor a keyless iframe with an added `source=outdoor` proves an official outdoor panorama. Outdoor imagery alone also does not establish traversable links or exclude tunnels.

## Namibia evidence and regeneration risk

`countries.js` requests the unqualified Wikipedia title `Independence Memorial Museum`. That [article](https://en.wikipedia.org/wiki/Independence_Memorial_Museum) describes Colombo. `tools/snap.mjs` resolves titles globally and snaps near that result without checking country membership, explaining how Colombo entered Namibia's data.

The intended Windhoek institution is separately documented by the [City of Windhoek](https://www.windhoekcc.org.na/independence-memorial-museum/) and [Museums Association of Namibia](https://www.museums.com.na/museums/windhoek/independence-museum). Confidence is high in removing the wrong-country point; no claim is made about imagery at the retained Windhoek start.

The generator and country records are outside the permitted edit scope. **Running `node geo/tools/snap.mjs` can reintroduce the error** until its input uses `Independence Memorial Museum (Namibia)` and geographic validation is added. Run the regression test after regeneration.

## Verification and next step

`node --test geo/walks.test.mjs geo/game.test.mjs`

The Namibia regression was observed failing on the original Colombo point before removal. Tests verify the coordinate contract and a local Windhoek bound; they do not contact Google.

Observed results: both new walk tests pass. The combined run passed 7 of 9 tests; existing game tests `clues cost points once; shape waits for every other clue` and `wrong guess costs points and points toward the answer` failed at `game.test.mjs:35` and `:56`. Concurrent workspace changes to `geo/game.js` were visible by the final check; game code was not edited in this task. These failures are outside this change's coordinate-data scope, and the combined suite is not claimed green.

For a later panorama rollout, obtain metadata with authorized credentials or inspect resolved public Maps panoramas interactively. For each candidate, record its ID, returned coordinates, attribution, capture date and verification date; visually check an outdoor street scene and working adjacent navigation. Retain coordinates for refreshing deleted IDs. Consuming pinned IDs requires a separate app change: the current app imports only `WALKS` and constructs coordinate-based iframes. Merely exporting a mapping would not change starts.
