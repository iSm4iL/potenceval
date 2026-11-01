// Maps Embed API: https://developers.google.com/maps/documentation/embed/embedding-map
export function streetViewUrl([lat, lng], key, language) {
  if (!key.trim()) return null;
  return 'https://www.google.com/maps/embed/v1/streetview?' + new URLSearchParams({
    key: key.trim(), location: `${lat},${lng}`, language, source: 'outdoor',
  });
}
