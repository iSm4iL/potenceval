"""Apply a user's saved review as metadata, never execute the attached HTML.

Usage: python music/tools/apply_review.py path/to/review.html [--apply]
Without --apply only writes the interpretation report under output/.
"""
import argparse
from collections import Counter
import copy
import json
from pathlib import Path
import re
import unicodedata
import build_catalog as b


def key(name):
    return unicodedata.normalize('NFKC', str(name)).lower().replace("ё", "е").strip()


def parse_review(text):
    def extract(ident):
        match = re.search(r'<script\b[^>]*\bid="' + ident + r'"[^>]*>(.*?)</script\s*>', text, re.S | re.I)
        if not match:
            raise ValueError("Missing review JSON: " + ident)
        return json.loads(match[1])
    data, state = extract("review-catalog"), extract("review-state")
    if not isinstance(data, dict) or not isinstance(state, dict) or not isinstance(data.get("collections"), list) or state.get("version") != 1:
        raise ValueError("Unsupported review")
    for field in ("tracks", "artists"):
        if not isinstance(state.get(field), dict):
            raise ValueError("Invalid review choices")
        for entries in state[field].values():
            if not isinstance(entries, dict):
                raise ValueError("Invalid collection choices")
            for choice in entries.values():
                if not isinstance(choice, dict) or choice.get("status", "unreviewed") not in ("keep", "remove", "unreviewed"):
                    raise ValueError("Invalid choice")
                if any(flag in choice and type(choice[flag]) is not bool for flag in ("more", "similar")):
                    raise ValueError("Invalid flag")
    return data, state


def make_plan(data, state, catalog):
    canonical = {t["id"]: t for t in catalog["tracks"]}
    result, seen = [], set()
    for collection in data["collections"]:
        scope = collection["id"]
        if scope in seen or not isinstance(scope, str) or not re.fullmatch(r'[a-z0-9-]+', scope):
            raise ValueError("Invalid or duplicate collection")
        seen.add(scope)
        ids = [t["id"] for t in collection["tracks"]]
        if len(ids) != len(set(ids)) or any(ident not in canonical for ident in ids):
            raise ValueError("Unknown or duplicate track ID in " + scope)
        tracks = [canonical[ident] for ident in ids]
        choices = state["tracks"].get(scope, {})
        artist_choices = state["artists"].get(scope, {})
        if any(ident not in ids for ident in choices):
            raise ValueError("Choices outside the review inventory")
        if not choices and not artist_choices:
            continue
        removed = [t for t in tracks if choices.get(t["id"], {}).get("status") == "remove"]
        allowed = [t for t in tracks if choices.get(t["id"], {}).get("status") == "keep" or (
            choices.get(t["id"], {}).get("status", "unreviewed") != "remove" and scope in t.get("genres", []))]
        allowed_ids = {t["id"] for t in allowed}
        requests, skipped = [], []
        names = {key(n): n for t in tracks for n in t["artistNames"]}
        for name_key, name in sorted(names.items()):
            preference = artist_choices.get(name_key, {})
            primary = [t for t in allowed if key(t["artistNames"][0]) == name_key]
            flagged = [t for t in primary if choices.get(t["id"], {}).get("more") or choices.get(t["id"], {}).get("similar")]
            wants_more = bool(preference.get("more") or any(choices.get(t["id"], {}).get("more") for t in flagged))
            wants_similar = bool(preference.get("similar") or any(choices.get(t["id"], {}).get("similar") for t in flagged))
            if not wants_more and not wants_similar:
                continue
            explicit = state.get("intentVersion") == 2 and (preference.get("more") or preference.get("similar"))
            credible = bool(flagged) and (any(len(t["artistIds"]) == 1 for t in flagged) or len(primary) >= 2)
            if (preference.get("status") == "remove" and not explicit) or not (explicit or credible):
                skipped.append({"name": name, "reason": "removed or guest/inherited flag; no independent expansion evidence"})
                continue
            seeds = [t for t in tracks if t["id"] in allowed_ids and any(key(n) == name_key for n in t["artistNames"])]
            if not seeds:
                continue
            artist_ids = Counter(ident for t in seeds for ident, n in zip(t["artistIds"], t["artistNames"]) if key(n) == name_key)
            requests.append({"name": name, "artistId": int(artist_ids.most_common(1)[0][0]), "more": wants_more, "similar": wants_similar,
                             "limit": 6 if wants_more and wants_similar else 4 if wants_more else 3,
                             "referenceIds": [t["deezerId"] for t in (flagged or seeds)]})
        result.append({"id": scope, "title": collection.get("title", scope), "allowedIds": [t["deezerId"] for t in allowed],
                       "removedIds": [t["deezerId"] for t in removed], "removedWorkKeys": sorted({t["workKey"] for t in removed} - {t["workKey"] for t in allowed}),
                       "requests": requests, "skipped": skipped, "newIds": []})
    return result


def apply_review(path, apply=False):
    catalog_path, config_path = b.ROOT / 'music/data/catalog.json', b.ROOT / 'music/data/sources.json'
    catalog, config = b.load_json(catalog_path, {}), b.load_json(config_path, {})
    data, state = parse_review(Path(path).read_text(encoding='utf-8-sig'))
    plan = make_plan(data, state, catalog)
    report_path = b.ROOT / 'output/music-review-applied.json'
    b.atomic_json(report_path, {"applied": False, "packs": plan})
    if not apply:
        return plan
    client, detail_cache, top_cache = b.Client(), {}, {}
    by_id = {t['deezerId']: t for t in catalog['tracks']}
    additions, failures = [], []
    banned_tracks = set(config.get('excludeTracks', []))
    global_bans = {b.normalize(n) for n in config.get('excludeArtists', [])}
    now = b.stamp()
    for pack in plan:
        scope = pack['id']
        allowed = [by_id[ident] for ident in pack['allowedIds']]
        known_credits = {ident for t in allowed for ident in t['artistIds']}
        existing_works = {t['workKey'] for t in allowed}
        for request in pack['requests']:
            artist_id = request['artistId']
            print(scope, request['name'], flush=True)
            try:
                if artist_id not in top_cache:
                    top_cache[artist_id] = client.get(f'https://api.deezer.com/artist/{artist_id}/top?limit=100').get('data', [])
                taken = 0
                for hint in top_cache[artist_id]:
                    title = hint.get('title', '')
                    if b.VERSION_WORDS.search(title) or hint['id'] in pack['removedIds'] or hint['id'] in banned_tracks:
                        continue
                    # Existing editions and rejected works cannot be reintroduced by top lists.
                    hinted_work = str(hint.get('artist', {}).get('id')) + '|' + b.canonical_title(title)
                    if hinted_work in existing_works or hinted_work in pack['removedWorkKeys']:
                        continue
                    if hint['id'] not in detail_cache:
                        detail_cache[hint['id']] = client.get('https://api.deezer.com/track/' + str(hint['id']))
                    raw = detail_cache[hint['id']]
                    if b.VERSION_WORDS.search(str(raw.get('title', '')) + ' ' + str(raw.get('title_version', ''))):
                        continue
                    row = {'title': raw.get('title', title), 'artists': [request['name']], 'artistIds': [artist_id],
                           'url': 'https://www.deezer.com/track/' + str(raw.get('id'))}
                    if raw.get('artist', {}).get('id') != artist_id or not b.match_track(row, raw)[0]:
                        continue
                    people = b.contributors(raw)
                    if any(b.normalize(p['name']) in global_bans for p in people):
                        continue
                    if not {str(p['id']) for p in people}.issubset(known_credits | {str(artist_id)}):
                        continue
                    if scope == 'nostalgia' and not ('2010' <= str(raw.get('release_date', ''))[:4] <= '2019'):
                        continue
                    track = b.public_track(raw, row)
                    if track['workKey'] in existing_works or track['workKey'] in pack['removedWorkKeys']:
                        continue
                    track.update(genres=[scope], currentGenres=[], sources=[])
                    additions.append(track)
                    by_id[track['deezerId']] = track
                    pack['allowedIds'].append(track['deezerId']); pack['newIds'].append(track['deezerId'])
                    existing_works.add(track['workKey'])
                    taken += 1
                    if taken >= request['limit']:
                        break
                request['added'] = taken
            except (OSError, ValueError, KeyError, TypeError) as error:
                failures.append({'collection': scope, 'artist': request['name'], 'error': str(error)[:200]})
            b.atomic_json(report_path, {'applied': False, 'packs': plan, 'failures': failures})
        source_id = 'player-review-' + scope
        rows = [{'title': by_id[ident]['title'], 'artists': [by_id[ident]['artistNames'][0]], 'artistIds': [int(by_id[ident]['artistIds'][0])],
                 'url': 'https://www.deezer.com/track/' + str(ident)} for ident in pack['allowedIds']]
        config['sources'] = [s for s in config['sources'] if not (s['id'] == source_id or s['id'].startswith(source_id + '-'))]
        catalog['sources'] = [s for s in catalog['sources'] if not (s['id'] == source_id or s['id'].startswith(source_id + '-'))]
        pack_refs = {}
        for offset in range(0, len(rows), 500):
            chunk_id = source_id + ('-' + str(offset // 500 + 1) if offset else '')
            chunk = rows[offset:offset + 500]
            source = {'id': chunk_id, 'kind': 'verified-tracks', 'title': 'Выбор игроков — ' + pack['title'], 'url': 'https://www.deezer.com/',
                      'genres': [scope], 'current': False, 'limit': 500, 'tracks': chunk}
            config['sources'].append(source)
            catalog['sources'].append({k: source[k] for k in ('id', 'kind', 'title', 'url')} | {'updatedAt': now, 'retrievedAt': now, 'status': 'fresh', 'count': len(chunk)})
            for ident in pack['allowedIds'][offset:offset + 500]:
                pack_refs[ident] = chunk_id
        pack['sourceRefs'] = pack_refs
        config.setdefault('collectionExcludeArtists', {}).pop(scope, None)
        config.setdefault('collectionTrackAllowlist', {})[scope] = {'ids': pack['allowedIds'],
            'workKeys': sorted({by_id[ident]['workKey'] for ident in pack['allowedIds']}), 'excludedIds': pack['removedIds'], 'excludedWorkKeys': pack['removedWorkKeys']}
    catalog['tracks'] = b.merge_tracks(catalog['tracks'] + additions)
    for pack in plan:
        refs_by_work = {by_id[ident]['workKey']: pack['sourceRefs'][ident] for ident in pack['allowedIds']}
        for track in catalog['tracks']:
            if track['workKey'] in refs_by_work:
                track['genres'] = b.unique(track['genres'] + [pack['id']])
                track['sources'].append({'id': refs_by_work[track['workKey']], 'genres': [pack['id']]})
    b.apply_collection_rules(catalog['tracks'], config)
    for track in catalog['tracks']:
        for field in ('preview', '_isrc', '_isrcs'):
            track.pop(field, None)
    catalog['generatedAt'] = now
    for source in catalog['sources']:
        source['count'] = sum(any(ref['id'] == source['id'] for ref in t['sources']) for t in catalog['tracks'])
    normalized = copy.deepcopy(state)
    normalized.update(intentVersion=2, catalogGeneratedAt=now, updatedAt=0)
    for pack in plan:
        expansion = {key(r['name']): r for r in pack['requests']}
        for name, choice in normalized['artists'].get(pack['id'], {}).items():
            choice['more'] = bool(expansion.get(name, {}).get('more'))
            choice['similar'] = bool(expansion.get(name, {}).get('similar'))
        # Legacy track-more may have been inherited from any duet member.
        for choice in normalized['tracks'].get(pack['id'], {}).values():
            choice['more'] = False
    b.validate_config(config)
    b.atomic_json(config_path, config); b.atomic_json(catalog_path, catalog)
    b.atomic_json(b.ROOT / 'music/data/player-review.json', normalized)
    b.atomic_json(report_path, {'applied': True, 'packs': plan, 'failures': failures})
    return plan


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    for pack in apply_review(args.input, args.apply):
        print(pack['id'], 'retained', len(pack['allowedIds']), 'removed', len(pack['removedIds']), 'new', len(pack['newIds']), flush=True)
