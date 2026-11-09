// Maps Embed API: https://developers.google.com/maps/documentation/embed/embedding-map
export function streetViewLink([lat, lng]) {
  return 'https://www.google.com/maps/@?' + new URLSearchParams({
    api: '1', map_action: 'pano', viewpoint: `${lat},${lng}`,
  });
}

export function streetViewUrl([lat, lng], key, language) {
  // shortcut: keep the original shared embed when no Maps Embed API key is configured.
  if (!key.trim()) {
    return 'https://www.google.com/maps/embed?' + new URLSearchParams({
      hl: language, pb: `!6m7!1m6!2m2!1d${lat}!2d${lng}!3f0!4f0!5f0.8`,
    });
  }
  return 'https://www.google.com/maps/embed/v1/streetview?' + new URLSearchParams({
    key: key.trim(), location: `${lat},${lng}`, language, source: 'outdoor',
  });
}
