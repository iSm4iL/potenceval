"""Bounded, evidence-first music catalog builder; Python 3.10+, standard library.

Run from the repository: python music/tools/build_catalog.py
Verified-tracks rows are editorial assertions backed by their source/row URL.
The builder verifies recording identity, not the historical claims on that URL.
"""
import argparse
import copy
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import tempfile
import threading
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import ProxyHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[2]
MAX_ROWS = 500
MAX_BYTES = 8 * 1024 * 1024
VERSION_WORDS = re.compile(r"\b(live|remix|cover|karaoke|sped[ -]?up|speed[ -]?up|slowed|tribute|instrumental|re[ -]?recorded|концерт\w*|ремикс|кавер|караоке)\b", re.I)
REMASTER = re.compile(r"\s*(?:[\[(]\s*(?:\d{4}\s+)?(?:re-?master(?:ed)?)(?:\s+(?:version|\d{4}))?\s*[\])]|[-–—]\s*(?:\d{4}\s+)?re-?master(?:ed)?(?:\s+(?:version|\d{4}))?)\s*$", re.I)
CREDIT = re.compile(r"\s+(?:&|and|feat\.?|ft\.?|featuring|x)\s+|\s*[,;]\s*", re.I)


def stamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def normalize(value):
    value = unicodedata.normalize("NFKC", str(value or "")).lower().replace("ё", "е")
    return " ".join("".join(c if c.isalnum() else " " for c in value).split())


def canonical_title(value):
    return normalize(REMASTER.sub("", str(value or "")))


def unique(items):
    return list(dict.fromkeys(items))


def secure_url(value):
    try:
        url = urlparse(value)
        return url.scheme == "https" and bool(url.hostname) and not url.username and not url.password
    except (ValueError, TypeError):
        return False


class Client:
    """One shared limiter covers source requests, detail requests, and retries."""
    def __init__(self):
        self.lock = threading.Lock()
        self.next_request = 0.0
        # Direct public requests avoid unreliable system proxy discovery on Windows.
        self.opener = build_opener(ProxyHandler({}))

    def get(self, url):
        if not secure_url(url):
            raise ValueError("Only public HTTPS URLs are supported")
        for attempt in range(3):
            with self.lock:
                delay = self.next_request - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
                self.next_request = time.monotonic() + 1 / 6
            try:
                request = Request(url, headers={"User-Agent": "CLGames-Catalog/1.0", "Accept": "application/json,text/html"})
                with self.opener.open(request, timeout=12) as response:
                    body = response.read(MAX_BYTES + 1)
                    if len(body) > MAX_BYTES:
                        raise ValueError("Response exceeds 8 MiB")
                    text = body.decode(response.headers.get_content_charset() or "utf-8")
                if text.lstrip().startswith(("{", "[")):
                    result = json.loads(text)
                    if isinstance(result, dict) and result.get("error"):
                        raise OSError("API error: " + str(result["error"])[:200])
                    return result
                return text
            except (HTTPError, URLError, TimeoutError, OSError) as exc:
                retry_after = exc.headers.get("Retry-After", "0") if isinstance(exc, HTTPError) else "0"
                if isinstance(exc, HTTPError):
                    exc.close()
                if isinstance(exc, HTTPError) and exc.code not in (408, 429, 500, 502, 503, 504):
                    raise
                if attempt == 2:
                    raise
                try:
                    delay = min(30, max(2 ** attempt, float(retry_after)))
                except ValueError:
                    delay = 2 ** attempt
                with self.lock:
                    self.next_request = max(self.next_request, time.monotonic() + delay)
        raise RuntimeError("Unreachable retry state")


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.scripts = []
        self.visible = []
        self.hidden = 0
        self.script = None
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
            if tag == "script":
                self.script = dict(attrs)
                self.parts = []
        elif not self.hidden and tag in ("p", "div", "li", "h1", "h2", "h3", "h4", "br", "article"):
            self.visible.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            if tag == "script" and self.script is not None:
                self.scripts.append((self.script, "".join(self.parts)))
                self.script = None
            self.hidden = max(0, self.hidden - 1)
        elif not self.hidden and tag in ("p", "div", "li", "h1", "h2", "h3", "h4", "article"):
            self.visible.append("\n")

    def handle_data(self, data):
        if self.script is not None:
            self.parts.append(data)
        elif not self.hidden:
            self.visible.append(data)


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def year(value):
    found = re.match(r"(\d{4})", str(value or ""))
    return int(found[1]) if found else None


def names(value):
    if not isinstance(value, list):
        value = [value]
    return [v["name"] if isinstance(v, dict) else v for v in value if isinstance(v, str) or isinstance(v, dict) and v.get("name")]


def parse_playlist(html):
    page = Page()
    page.feed(html)
    ld_rows, server_rows = [], []
    for attrs, content in page.scripts:
        if attrs.get("type") != "application/ld+json" and attrs.get("id") != "serialized-server-data":
            continue
        try:
            data = json.loads(content)
        except (ValueError, TypeError):
            continue
        if attrs.get("type") == "application/ld+json":
            for playlist in walk(data):
                if "MusicPlaylist" not in names(playlist.get("@type", [])):
                    continue
                tracks = playlist.get("track", [])
                if isinstance(tracks, dict):
                    tracks = tracks.get("itemListElement", [tracks])
                for position, wrapper in enumerate(tracks, 1):
                    if not isinstance(wrapper, dict):
                        continue
                    track = wrapper.get("item", wrapper)
                    if not isinstance(track, dict) or not track.get("name"):
                        continue
                    ld_rows.append({"title": track["name"], "artists": names(track.get("byArtist", [])),
                                    "position": wrapper.get("position", position), "year": year(track.get("datePublished")),
                                    "duration": track.get("duration"), "rawGenres": names(track.get("genre", [])),
                                    "url": track.get("url", "")})
        else:
            seen = set()
            for item in walk(data):
                descriptor = item.get("contentDescriptor", {})
                if not isinstance(descriptor, dict) or descriptor.get("kind") != "song" or not item.get("title") or not item.get("artistName"):
                    continue
                ident = str(descriptor.get("identifiers", {}).get("storeAdamID") or item.get("id") or descriptor.get("url") or "")
                if not ident or ident in seen:
                    continue
                seen.add(ident)
                links = item.get("subtitleLinks", [])
                artists = [link["title"] for link in links if isinstance(link, dict) and link.get("title")]
                server_rows.append({"title": item["title"], "artists": unique(artists) or [item["artistName"]],
                                    "position": len(server_rows) + 1, "url": descriptor.get("url", ""),
                                    "duration": item.get("duration"), "year": None, "rawGenres": []})
    if server_rows:
        for row in server_rows:
            matching = [other for other in ld_rows if canonical_title(other["title"]) == canonical_title(row["title"])]
            # Do not borrow metadata from another recording with the same title.
            if len(matching) == 1:
                row["year"] = matching[0]["year"]
                row["rawGenres"] = matching[0]["rawGenres"]
        return server_rows
    return [row for row in ld_rows if row["artists"]]


def parse_chart(data):
    if isinstance(data, str):
        data = json.loads(data)
    return [{"title": item["name"], "artists": [item["artistName"]], "position": position,
             "year": year(item.get("releaseDate")), "rawGenres": names(item.get("genres", [])),
             "url": item.get("url", "")}
            for position, item in enumerate(data.get("feed", {}).get("results", []), 1)
            if item.get("name") and item.get("artistName")]


def parse_planet(html):
    page = Page()
    page.feed(html)
    pattern = re.compile(r"(?:^|\n)\s*(\d+)\)\s+(.+?)\s+[-–—]\s+(.+?)\s*\((\d{4})\)", re.M)
    return [{"position": int(m[1]), "artists": [m[2].strip()], "title": m[3].strip(), "year": int(m[4]), "rawGenres": []}
            for m in pattern.finditer("".join(page.visible))]


def artist_top_rows(source, client):
    """Самые популярные песни исполнителей из списка (Deezer /artist/{id}/top), без live/remix/sped up.

    Исполнитель находится по точному имени; при тёзках берём того, у кого больше подписчиков.
    Сбой одного исполнителя не роняет весь источник.
    """
    per = max(1, min(10, int(source.get("perArtist", 5))))
    rows = []
    for name in source.get("artists", []):
        try:
            found = client.get("https://api.deezer.com/search/artist?" + urlencode({"q": name, "limit": 10}))
            exact = [a for a in (found.get("data") or []) if isinstance(a, dict) and isinstance(a.get("id"), int) and normalize(a.get("name")) == normalize(name)]
            if not exact:
                continue
            artist = max(exact, key=lambda a: a.get("nb_fan") or 0)
            top = client.get("https://api.deezer.com/artist/" + str(artist["id"]) + "/top?" + urlencode({"limit": per * 3}))
        except (OSError, ValueError, TypeError, AttributeError):
            continue
        taken, titles = 0, set()
        items = top.get("data") if isinstance(top, dict) else None
        for item in items or []:
            title = item.get("title") if isinstance(item, dict) else None
            if not isinstance(title, str) or not title.strip() or canonical_title(title) in titles:
                continue
            if VERSION_WORDS.search(title + " " + str(item.get("title_version", ""))):
                continue
            if normalize(name) not in {normalize(p["name"]) for p in contributors(item)}:
                continue
            titles.add(canonical_title(title))
            taken += 1
            rows.append({"title": title, "artists": [name], "position": taken, "period": "популярное у " + name,
                         "url": "https://www.deezer.com/artist/" + str(artist["id"])})
            if taken >= per:
                break
    return rows


def source_rows(source, payload=None, limit_per_source=None):
    kind = source["kind"]
    if kind == "deezer-artist-top":
        rows = copy.deepcopy(payload or [])
    elif kind == "apple-playlist":
        rows = parse_playlist(payload)
    elif kind == "apple-chart":
        rows = parse_chart(payload)
    elif kind == "planet-rock":
        rows = parse_planet(payload)
    elif kind == "verified-tracks":
        rows = copy.deepcopy(source.get("tracks", []))
        for position, row in enumerate(rows, 1):
            row.setdefault("position", position)
    else:
        raise ValueError("Unsupported source kind: " + str(kind))
    if not rows:
        raise ValueError("Source contains no recognizable evidence rows")
    limit = min(MAX_ROWS, int(source.get("limit", MAX_ROWS)), limit_per_source or MAX_ROWS)
    selected = []
    for row in rows:
        if not isinstance(row.get("title"), str) or not row["title"].strip() or not isinstance(row.get("artists"), list) or not row["artists"] or not all(isinstance(a, str) and a.strip() for a in row["artists"]):
            raise ValueError("Evidence row needs a title and nonempty artist names")
        if source.get("maxYear") is not None and (row.get("year") is None or row["year"] > source["maxYear"]):
            continue
        if source.get("maxPosition") is not None and int(row["position"]) > source["maxPosition"]:
            continue
        selected.append(row)
    return selected[:max(0, limit)]


def row_genres(source, row, config, verified_names=None):
    artists = {normalize(a) for a in row["artists"]}
    if verified_names:
        # Split composite source credits only when all parts were verified.
        for credit in row["artists"]:
            if normalize(credit) not in {normalize(a) for a in verified_names}:
                parts = CREDIT.split(credit)
                if len(parts) > 1 and all(normalize(a) in {normalize(n) for n in verified_names} for a in parts):
                    artists.update(normalize(a) for a in parts)
    cohort = bool(artists & {normalize(a) for a in config.get("newWaveArtists", [])})
    if source["kind"] != "apple-chart":
        result = unique(source.get("genres", []) + row.get("genres", []))
        if "ru-rap" in result and cohort and "new-wave" not in result:
            result.append("new-wave")
        return result
    raw_genres = {normalize(g) for g in row.get("rawGenres", [])}
    russian = any(re.search("[а-яё]", a, re.I) for a in row["artists"]) or bool(artists & {normalize(a) for a in config.get("russianArtists", [])})
    result = []
    if raw_genres & {"pop", "r b soul", "r b", "поп", "поп музыка", "r b и соул"}:
        result.append("ru-pop" if russian else "pop-rnb")
    rap = bool(raw_genres & {"hip hop rap", "hip hop", "rap", "хип хоп рэп", "хип хоп", "хипхоп рэп", "рэп"})
    if rap:
        result.append("ru-rap" if russian else "western-rap")
    if raw_genres & {"rock", "alternative", "рок", "альтернатива", "альтернативная музыка"}:
        result.append("ru-rock" if russian else "alt-rock")
    if raw_genres & {"electronic", "dance", "house", "хаус", "электроника", "электронная музыка", "танцевальная", "танцевальная музыка"}:
        result.append("electronic")
    if rap and cohort:
        result.append("new-wave")
    return result


def contributors(raw):
    people = [raw.get("artist", {})] + (raw.get("contributors") or [])
    result, seen = [], set()
    for person in people:
        if isinstance(person, dict) and person.get("id") and isinstance(person.get("name"), str) and person["name"].strip():
            ident = str(person["id"])
            if ident not in seen:
                result.append(person)
                seen.add(ident)
    return result


def artist_match(expected, actual):
    actual = {normalize(a) for a in actual}
    for artist in expected:
        if normalize(artist) in actual:
            continue
        parts = CREDIT.split(artist)
        if len(parts) < 2 or not all(normalize(part) in actual for part in parts):
            return False
    return True


def match_track(row, raw):
    if not isinstance(raw, dict) or not isinstance(raw.get("id"), int) or isinstance(raw["id"], bool) or raw["id"] <= 0:
        return False, "invalid track detail"
    if not raw.get("artist", {}).get("id") or not raw.get("artist", {}).get("name"):
        return False, "missing main artist"
    if not artist_match(row["artists"], [p["name"] for p in contributors(raw)]):
        return False, "artist mismatch"
    expected_versions = {normalize(m[0]) for m in VERSION_WORDS.finditer(row["title"])}
    actual_versions = {normalize(m[0]) for m in VERSION_WORDS.finditer(str(raw.get("title", "")) + " " + str(raw.get("title_version", "")))}
    if not actual_versions.issubset(expected_versions):
        return False, "unrequested version"
    if canonical_title(row["title"]) != canonical_title(raw.get("title")):
        return False, "title mismatch"
    preview = urlparse(str(raw.get("preview", "")))
    if preview.scheme != "https" or not (preview.hostname or "").endswith(".dzcdn.net"):
        return False, "missing usable preview"
    if not isinstance(raw.get("duration"), (int, float)) or raw["duration"] < 30 or raw.get("readable") is False:
        return False, "short or unavailable recording"
    return True, "exact match"


def lookup_key(row):
    return ",".join(sorted(normalize(a) for a in row["artists"])) + "|" + canonical_title(row["title"])


def public_track(raw, row):
    people = contributors(raw)
    cover = raw.get("album", {}).get("cover_medium", "")
    cover_url = urlparse(str(cover))
    if cover_url.scheme != "https" or not (cover_url.hostname or "").endswith(".dzcdn.net"):
        cover = ""
    main_id = str(raw["artist"]["id"])
    return {"id": "dz-" + str(raw["id"]), "deezerId": raw["id"], "title": raw["title"],
            "artist": ", ".join(unique(p["name"] for p in people)), "artistIds": [str(p["id"]) for p in people],
            "artistNames": unique(p["name"] for p in people),
            "answerKey": main_id + "|" + normalize(raw.get("title_short") or raw["title"]),
            "workKey": main_id + "|" + canonical_title(raw["title"]), "cover": cover,
            "link": "https://www.deezer.com/track/" + str(raw["id"]),
            "genres": [], "currentGenres": [], "sources": [], "lookupKeys": [lookup_key(row)],
            "_isrc": str(raw.get("isrc") or "").upper()}


def resolve(row, client):
    # Exact editorial links also cover releases absent from Deezer's search index.
    pinned = re.fullmatch(r"https://(?:www\.)?deezer\.com/track/([1-9]\d*)/?(?:[?#].*)?", str(row.get("url", "")))
    if pinned:
        try:
            detail = client.get("https://api.deezer.com/track/" + pinned[1])
        except (OSError, ValueError, TypeError):
            detail = None
        if isinstance(detail, dict) and detail.get("id") == int(pinned[1]) and match_track(row, detail)[0]:
            return public_track(detail, row), None
    query = " ".join(row["artists"]) + " " + row["title"]
    result = client.get("https://api.deezer.com/search?" + urlencode({"q": query, "limit": 25}))
    if not isinstance(result, dict) or not isinstance(result.get("data"), list):
        raise ValueError("Invalid Deezer search response")
    candidates = []
    reasons = []
    for raw in result["data"][:25]:
        # Search responses may omit contributors and duration; identity hints only.
        if not isinstance(raw, dict) or not isinstance(raw.get("id"), int):
            continue
        if canonical_title(raw.get("title")) != canonical_title(row["title"]):
            reasons.append("title mismatch")
            continue
        candidates.append(raw)
    candidates.sort(key=lambda r: (not artist_match(row["artists"], [p["name"] for p in contributors(r)]), bool(VERSION_WORDS.search(r.get("title", ""))), r["id"]))
    samples = []
    for candidate in candidates[:5]:
        detail = client.get("https://api.deezer.com/track/" + str(candidate["id"]))
        if not isinstance(detail, dict) or detail.get("id") != candidate["id"]:
            reasons.append("detail ID mismatch")
            continue
        accepted, reason = match_track(row, detail)
        samples.append({"id": detail["id"], "title": detail.get("title"), "artist": detail.get("artist", {}).get("name"), "reason": reason})
        if accepted:
            return public_track(detail, row), None
        reasons.append(reason)
    return None, {"reason": "; ".join(unique(reasons)) or "no search results", "samples": samples}


def merge_tracks(tracks):
    # Union by either key also handles transitive ISRC/work collisions.
    parents = list(range(len(tracks)))
    seen = {}

    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    for i, track in enumerate(tracks):
        isrcs = unique(track.get("_isrcs", []) + ([track["_isrc"]] if track.get("_isrc") else []))
        for key in ["id:" + track["id"], "work:" + track["workKey"]] + ["isrc:" + isrc for isrc in isrcs]:
            if key in seen:
                parents[root(i)] = root(seen[key])
            seen[key] = i
    merged = {}
    for i, track in enumerate(tracks):
        group = root(i)
        if group not in merged:
            merged[group] = copy.deepcopy(track)
            continue
        target = merged[group]
        target["_isrcs"] = unique(target.get("_isrcs", []) + track.get("_isrcs", []) + ([track["_isrc"]] if track.get("_isrc") else []))
        for key in ("genres", "currentGenres", "lookupKeys"):
            target[key] = unique(target.get(key, []) + track.get(key, []))
        for source in track.get("sources", []):
            if source not in target["sources"]:
                target["sources"].append(copy.deepcopy(source))
    return list(merged.values())


def load_json(path, fallback):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return fallback


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix="." + path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def recent(value):
    try:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(value.replace("Z", "+00:00"))
        return timedelta(0) <= age < timedelta(days=7)
    except (ValueError, AttributeError, TypeError):
        return False


def upstream_date(payload, fallback):
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            return fallback
    value = payload.get("feed", {}).get("updated") if isinstance(payload, dict) else None
    if isinstance(value, dict):
        value = value.get("label")
    if not value:
        return fallback
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = parsedate_to_datetime(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def validate_config(config):
    if not isinstance(config, dict) or config.get("version") != 1 or not isinstance(config.get("sources"), list) or not 1 <= len(config["sources"]) <= 100:
        raise ValueError("Expected version 1 and 1..100 sources")
    if not all(isinstance(a, str) for a in config.get("excludeArtists", [])) or not all(type(i) is int for i in config.get("excludeTracks", [])):
        raise ValueError("excludeArtists must be names, excludeTracks must be Deezer track IDs")
    ids = set()
    for source in config["sources"]:
        if not isinstance(source, dict) or not all(isinstance(source.get(k), str) and source[k].strip() for k in ("id", "kind", "title", "url")):
            raise ValueError("Each source needs id, kind, title, url")
        if source["id"] in ids or not secure_url(source["url"]):
            raise ValueError("Source IDs must be unique; URLs must use HTTPS")
        ids.add(source["id"])
        if not isinstance(source.get("genres", []), list):
            raise ValueError("Source genres must be an array")
        if source.get("limit") is not None and (type(source["limit"]) is not int or source["limit"] < 1):
            raise ValueError("Source limit must be a positive integer")


def build(sources_path, output_path, workers=4, limit_per_source=None, client=None):
    config = load_json(sources_path, None)
    validate_config(config)
    output_path = Path(output_path)
    review_path = output_path.with_name("review.json")
    prior = load_json(output_path, {})
    previous_review = load_json(review_path, {})
    now = stamp()
    old_tracks = prior.get("tracks", [])
    old_sources = {s["id"]: s for s in prior.get("sources", [])}
    old_matches = previous_review.get("matchCache", {})
    old_recordings = previous_review.get("recordings", {})
    cache = {}
    for track in old_tracks:
        for key in track.get("lookupKeys", []):
            entry = old_matches.get(key, {})
            validated_at = entry.get("verifiedAt", prior.get("generatedAt"))
            if recent(validated_at):
                cached_track = copy.deepcopy(track)
                cached_track["_isrcs"] = old_recordings.get(track["id"], {}).get("isrcs", [])
                cache[key] = (cached_track, validated_at)
    client = client or Client()
    report = {"version": 1, "generatedAt": now, "published": False, "counts": {"rows": 0, "matched": 0, "unmatched": 0, "cached": 0},
              "unmatched": [], "sources": [], "warnings": [], "matchCache": {}, "recordings": {}}
    resolved, metadata, failed = [], [], set()
    success = 0
    with ThreadPoolExecutor(max_workers=max(1, min(4, workers))) as pool:
        for source in config["sources"]:
            ident = source["id"]
            print("[" + ident + "] retrieving source", flush=True)
            meta = {k: source[k] for k in ("id", "title", "url", "kind")}
            meta.update(updatedAt=now, retrievedAt=now, status="fresh", count=0)
            source_report = {"id": ident, "rows": 0, "matched": 0, "unmatched": 0}
            try:
                if source["kind"] == "deezer-artist-top":
                    payload = artist_top_rows(source, client)
                else:
                    payload = None if source["kind"] == "verified-tracks" else client.get(source["url"])
                if source["kind"] == "apple-chart":
                    meta["updatedAt"] = upstream_date(payload, now)
                rows = source_rows(source, payload, limit_per_source)
                print("[" + ident + "] matching " + str(len(rows)) + " evidence rows", flush=True)
                source_report["rows"] = len(rows)
                report["counts"]["rows"] += len(rows)

                def lookup(row):
                    key = lookup_key(row)
                    if key in cache:
                        track, validated_at = cache[key]
                        # A key match is rechecked against saved title and contributor names.
                        if canonical_title(row["title"]) == canonical_title(track.get("title")) and artist_match(row["artists"], track.get("artistNames", [])):
                            return copy.deepcopy(track), None, validated_at, True
                    try:
                        track, failure = resolve(row, client)
                        return track, failure, now, False
                    except (OSError, ValueError, TypeError, KeyError) as exc:
                        return None, {"reason": "lookup failed: " + str(exc)[:250], "apiError": True, "samples": []}, now, False

                for index, (row, (track, failure, validated_at, cached)) in enumerate(zip(rows, pool.map(lookup, rows)), 1):
                    if index == 1 or index % 10 == 0:
                        print("[" + ident + "] " + str(index) + "/" + str(len(rows)) + " checked", flush=True)
                    if track is None:
                        entry = {"sourceId": ident, "title": row["title"], "artists": row["artists"],
                                 "position": row.get("position"), "url": row.get("url") or source["url"], **failure}
                        report["unmatched"].append(entry)
                        source_report["unmatched"] += 1
                        report["counts"]["unmatched"] += 1
                        if failure.get("apiError"):
                            failed.add(ident)
                        continue
                    genres = row_genres(source, row, config, verified_names=track["artistNames"])
                    active = source.get("current", source["kind"] == "apple-chart")
                    provenance = {"id": ident, "position": row.get("position"), "genres": genres[:]}
                    if row.get("period"):
                        provenance["period"] = row["period"]
                    elif source["kind"] == "apple-chart":
                        provenance["period"] = meta["updatedAt"][:10]
                    track.update(genres=genres, currentGenres=genres[:] if active else [],
                                 sources=[provenance], lookupKeys=[lookup_key(row)])
                    resolved.append(track)
                    report["matchCache"][lookup_key(row)] = {"verifiedAt": validated_at, "trackId": track["id"]}
                    source_report["matched"] += 1
                    report["counts"]["matched"] += 1
                    report["counts"]["cached"] += int(cached)
                if ident not in failed:
                    success += 1
            except (OSError, ValueError, TypeError, KeyError) as exc:
                failed.add(ident)
                source_report["error"] = str(exc)[:300]
            if ident in failed:
                previous = old_sources.get(ident, {})
                meta.update(status="stale", updatedAt=previous.get("updatedAt"), retrievedAt=previous.get("retrievedAt"))
                report["warnings"].append(ident + ": " + source_report.get("error", "some Deezer lookups failed; old evidence retained"))
            metadata.append(meta)
            report["sources"].append(source_report)
            print("[" + ident + "] " + meta["status"] + ": " + str(source_report["matched"]) + " matched, " + str(source_report["unmatched"]) + " unmatched", flush=True)
    config_sources = {s["id"]: s for s in config["sources"]}
    for track in old_tracks:
        refs = [r for r in track.get("sources", []) if r.get("id") in failed]
        if refs:
            preserved = copy.deepcopy(track)
            preserved["sources"] = refs
            for ref in refs:
                # Old schema has no per-row genres: curated genres are recoverable;
                # chart row genres must be refreshed before using current mode.
                ref.setdefault("genres", [g for g in config_sources[ref["id"]].get("genres", []) if g in track.get("genres", [])])
            preserved["genres"] = unique(g for ref in refs for g in ref["genres"])
            preserved["currentGenres"] = unique(g for ref in refs if config_sources[ref["id"]].get("current", config_sources[ref["id"]]["kind"] == "apple-chart") for g in ref["genres"])
            preserved["_isrcs"] = old_recordings.get(track["id"], {}).get("isrcs", [])
            resolved.append(preserved)
            for key in track.get("lookupKeys", []):
                report["matchCache"].setdefault(key, old_matches.get(key, {"verifiedAt": prior.get("generatedAt"), "trackId": track["id"]}))
    tracks = merge_tracks(resolved)
    # Стоп-лист: исполнители не в тему подборок и записи, чьё превью не играет в браузере.
    banned_artists = {normalize(a) for a in config.get("excludeArtists", [])}
    banned_tracks = set(config.get("excludeTracks", []))
    tracks = [t for t in tracks if t["deezerId"] not in banned_tracks and not banned_artists & {normalize(n) for n in t["artistNames"]}]
    for track in tracks:
        report["recordings"][track["id"]] = {"isrcs": unique(track.get("_isrcs", []) + ([track["_isrc"]] if track.get("_isrc") else []))}
        track.pop("preview", None)
        track.pop("_isrc", None)
        track.pop("_isrcs", None)
    for meta in metadata:
        meta["count"] = sum(any(ref["id"] == meta["id"] for ref in track["sources"]) for track in tracks)
    report["counts"]["tracks"] = len(tracks)
    report["counts"]["failedSources"] = len(failed)
    if success and tracks:
        catalog = {"version": 1, "generatedAt": now, "sources": metadata, "tracks": tracks, "warnings": report["warnings"]}
        atomic_json(output_path, catalog)
        report["published"] = True
    else:
        report["warnings"].append("Catalog not replaced: no successful sources or no valid tracks")
        # Retain original verification dates even when this run does not publish.
        report["matchCache"] = old_matches
        report["recordings"] = old_recordings
    atomic_json(review_path, report)
    return report["published"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=ROOT / "music/data/sources.json")
    parser.add_argument("--output", type=Path, default=ROOT / "music/data/catalog.json")
    parser.add_argument("--workers", type=int, default=4, help="1..4 workers; larger values are clamped to 4")
    parser.add_argument("--limit-per-source", type=int, help="Initial-run cap, at most 500 rows per source")
    args = parser.parse_args()
    if args.workers < 1 or args.limit_per_source is not None and args.limit_per_source < 1:
        parser.error("workers and limit-per-source must be positive")
    try:
        published = build(args.sources, args.output, args.workers, args.limit_per_source)
    except (OSError, ValueError) as exc:
        print("Catalog build failed:", exc)
        return 2
    print("Catalog updated." if published else "Catalog preserved; inspect review.json.")
    return 0 if published else 1


if __name__ == "__main__":
    raise SystemExit(main())
