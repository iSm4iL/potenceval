// Maps Embed API: https://developers.google.com/maps/documentation/embed/embedding-map
export function streetViewLink([lat, lng]) {
  return 'https://www.google.com/maps/@?' + new URLSearchParams({
    api: '1', map_action: 'pano', viewpoint: `${lat},${lng}`,
  });
}

export function streetViewUrl([lat, lng], key, language) {
  if (!key.trim()) return null;
  return 'https://www.google.com/maps/embed/v1/streetview?' + new URLSearchParams({
    key: key.trim(), location: `${lat},${lng}`, language, source: 'outdoor',
  });
}
