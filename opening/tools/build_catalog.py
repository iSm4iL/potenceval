"""Assemble reviewed soundtrack records and genre-compatible answer choices."""
import datetime
import json
import pathlib
import re
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE_FILES = ('anime-originals.json','anime-expansion.json','film-expansion.json','series-expansion.json','cartoon-expansion.json')

def tags(entry, field):
    aliases = {'sciencefiction':'scifi','scifi':'scifi','romantic':'romance','animated':'animation','families':'family'}
    values = {re.sub(r'[^a-z0-9]', '', tag.lower()) for tag in entry.get(field, [])}
    return {aliases.get(tag, tag) for tag in values if tag}

def assemble(sources):
    entries = []
    ids, recordings = set(), set()
    for source in sources:
        for raw in source:
            if raw.get('disabledReason'):
                continue
            entry = dict(raw)
            entry.setdefault('category', 'anime')
            entry.setdefault('themeKind', 'opening' if entry['category']=='anime' else 'soundtrack')
            if entry['animeId'] in ids or entry['trackId'] in recordings:
                raise ValueError(f'duplicate title/recording: {entry["animeId"]}')
            ids.add(entry['animeId']); recordings.add(entry['trackId'])
            entries.append(entry)
    for entry in entries:
        genres, mood = tags(entry, 'genres'), tags(entry, 'moodTags')
        curated = set(entry.get('distractorIds', []))
        candidates = []
        for other in entries:
            if other['category'] != entry['category'] or other['franchiseId'] == entry['franchiseId'] or other['trackId'] == entry['trackId']:
                continue
            score = 5*len(genres & tags(other, 'genres')) + 2*len(mood & tags(other, 'moodTags'))
            score += 8 if entry['artistId'] == other['artistId'] else 0
            score += 6 if other['animeId'] in curated else 0
            if score:
                candidates.append((score, other['animeId']))
        candidates.sort(key=lambda item: (-item[0], item[1]))
        if len(candidates) < 3:
            raise ValueError(f'need three similar answers: {entry["animeId"]}')
        entry['distractorIds'] = [key for _, key in candidates[:12]]
    return {'version':2,'checkedAt':datetime.date.today().isoformat(),'counts':dict(Counter(e['category'] for e in entries)), 'entries':entries}

def main():
    sources = [json.loads((ROOT/'data'/name).read_text(encoding='utf-8-sig')) for name in SOURCE_FILES]
    data = assemble(sources)
    from check_catalog import validate
    errors = validate(data)
    if errors:
        raise ValueError('\n'.join(errors))
    (ROOT/'data'/'catalog.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Built {len(data["entries"])} titles: {data["counts"]}')

if __name__=='__main__':
    main()
