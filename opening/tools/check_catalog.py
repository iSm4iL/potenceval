"""Validate the published anime catalog. Exit nonzero on incomplete/ambiguous data."""
import json
import pathlib
import sys
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
FIELDS = ('animeId','titleRu','titleOriginal','franchiseId','genres','moodTags','poster','posterSource','trackId','trackTitle','artist','artistId','distractorIds','themeSource','checkedAt')

def validate(catalog):
    errors = []
    entries = catalog.get('entries', [])
    if len(entries) < 10: errors.append('need at least ten titles')
    categories = ('anime', 'film', 'series', 'cartoon')
    if catalog.get('version', 1) >= 2:
        for category in categories:
            count = len({x.get('franchiseId') for x in entries if x.get('category') == category})
            if count < 10: errors.append(f'{category}: need ten distinct franchises')
    by_id = {x.get('animeId'):x for x in entries}
    seen_ids, seen_tracks = set(), set()
    for entry in entries:
        key = entry.get('animeId', '?')
        if entry.get('category', 'anime') not in categories: errors.append(f'{key}: unknown category')
        for field in FIELDS:
            if not entry.get(field): errors.append(f'{key}: missing {field}')
        if key in seen_ids: errors.append(f'{key}: duplicate animeId')
        if entry.get('trackId') in seen_tracks: errors.append(f'{key}: duplicate trackId')
        seen_ids.add(key); seen_tracks.add(entry.get('trackId'))
        if not isinstance(entry.get('trackId'), int) or entry['trackId'] <= 0:
            errors.append(f'{key}: invalid trackId')
        poster = urlparse(entry.get('poster', ''))
        if poster.scheme != 'https' or poster.hostname not in ('s4.anilist.co', 'upload.wikimedia.org', 'thumb.wikimedia.org', 'static.tvmaze.com', 'image.tmdb.org'):
            errors.append(f'{key}: invalid poster URL')
        distractors = set(entry.get('distractorIds', []))
        valid = []
        for other_id in distractors:
            other = by_id.get(other_id)
            if not other: errors.append(f'{key}: unknown distractor {other_id}')
            elif other.get('category', 'anime') == entry.get('category', 'anime') and other.get('franchiseId') != entry.get('franchiseId') and other.get('trackId') != entry.get('trackId'):
                valid.append(other_id)
        if len(valid) < 3: errors.append(f'{key}: need three distractors from other franchises')
    return errors

def main():
    path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'data' / 'catalog.json'
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    errors = validate(data)
    if errors:
        print('\n'.join(errors)); return 1
    print(f'OK: {len(data["entries"])} titles, distinct originals, at least three compatible distractors each.')
    return 0

if __name__ == '__main__': sys.exit(main())
