The globe uses `world-map.svg`, an equirectangular texture built from Natural Earth 1:110m land polygons v5.1.2 (public domain).

Source: https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_land.geojson

Rebuild from a downloaded GeoJSON file:

    node where/tools/build-globe-map.mjs path/to/ne_110m_land.geojson

The canvas projects the rectangular map onto a lit sphere. Rotation pauses when the globe is offscreen, the page is hidden, or reduced motion is requested; the globe button also pauses it.
