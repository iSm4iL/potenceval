"""Offline contract tests. Run: python -m unittest discover -s music/tools -v."""
from contextlib import contextmanager
from datetime import datetime, timezone
from email.message import Message
import io
import json
from pathlib import Path
import shutil
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from uuid import uuid4

try:
    import build_catalog as b
except ImportError:
    b = None
try:
    import serve
except ImportError:
    serve = None


@contextmanager
def workspace_temp():
    # Inherit workspace ACLs; Windows sandbox cannot reopen mode-0700 temp dirs.
    parent = Path(__file__).resolve().parent
    directory = parent / ("test-tmp-" + uuid4().hex)
    directory.mkdir()
    try:
        yield directory
    finally:
        assert directory.resolve().parent == parent
        shutil.rmtree(directory)


def raw(track_id=10, title="Sultans of Swing", artist="Dire Straits", artist_id=176, **extra):
    value = {"id": track_id, "title": title, "title_short": title, "duration": 345,
             "artist": {"id": artist_id, "name": artist},
             "contributors": [{"id": artist_id, "name": artist}],
             "preview": "https://cdn-preview-a.dzcdn.net/stream/test.mp3",
             "album": {"cover_medium": "https://cdn-images.dzcdn.net/images/cover/test.jpg"},
             "isrc": "GBABC7700001", "readable": True}
    value.update(extra)
    return value


class FakeClient:
    def __init__(self, tracks=None, pages=None):
        self.tracks = tracks or [raw()]
        self.pages = pages or {}
        self.calls = []

    def get(self, url):
        self.calls.append(url)
        if "/artist/" in url:
            raise AssertionError("Artist endpoints are forbidden")
        if url.startswith("https://api.deezer.com/search?"):
            return {"data": self.tracks}
        if url.startswith("https://api.deezer.com/track/"):
            ident = int(url.rsplit("/", 1)[1])
            return next(t for t in self.tracks if t["id"] == ident)
        result = self.pages.get(url, OSError("source unavailable"))
        if isinstance(result, Exception):
            raise result
        return result


class BuilderTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(b, "build_catalog implementation must exist")
        self.output = patch("builtins.print")
        self.output.start()
        self.addCleanup(self.output.stop)

    def test_playlist_jsonld_graph_track_wrappers_and_metadata(self):
        html = '''<script type="application/ld+json">{"@graph":[{"@type":"MusicPlaylist",
        "track":[{"@type":"ListItem","position":2,"item":{"@type":"MusicRecording",
        "name":"Sultans of Swing","byArtist":{"name":"Dire Straits"},
        "datePublished":"1977-01-01","duration":"PT5M45S","genre":["Rock"]}}]}]}</script>'''
        rows = b.parse_playlist(html)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["artists"], ["Dire Straits"])
        self.assertEqual(rows[0]["position"], 2)
        self.assertEqual(rows[0]["year"], 1977)
        self.assertEqual(rows[0]["rawGenres"], ["Rock"])

    def test_chart_uses_feed_metadata_and_keeps_band_names_unsplit(self):
        rows = b.parse_chart({"feed": {"results": [{"name": "Song", "artistName": "Earth, Wind & Fire",
                 "genres": [{"name": "Pop"}], "releaseDate": "1981-02-03", "id": "12"}]}})
        self.assertEqual(rows[0]["artists"], ["Earth, Wind & Fire"])
        self.assertEqual(rows[0]["position"], 1)
        self.assertEqual(rows[0]["year"], 1981)

    def test_playlist_serialized_server_data_supplies_missing_jsonld_artists(self):
        item = {"id": "track-lockup - pl.ID - 1006607505", "title": "Поворот", "artistName": "Машина Времени",
                "duration": 195800, "contentDescriptor": {"kind": "song", "identifiers": {"storeAdamID": "1006607505"},
                "url": "https://music.apple.com/us/album/song/1006607505"}, "subtitleLinks": [{"title": "Машина Времени"}]}
        html = '<script type="application/ld+json">{"@type":"MusicPlaylist","track":[{"name":"Поворот","datePublished":"1979","duration":"PT3M15S"}]}</script>'
        html += '<script type="application/json" id="serialized-server-data">' + json.dumps({"data": [{"data": {"sections": [{"itemKind": "trackLockup", "items": [item, item]}]}}]}) + '</script>'
        rows = b.parse_playlist(html)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["artists"], ["Машина Времени"])
        self.assertEqual(rows[0]["year"], 1979)
        self.assertEqual(rows[0]["position"], 1)

    def test_planet_visible_text_ignores_script_style_and_applies_bounds(self):
        html = '<script>1) Fake - Nope (1970)</script><style>2) Bad - Nope (1970)</style><h2>79) Dire Straits - Sultans of Swing (1977)</h2><p>80) New Band – Song (2025)</p>'
        rows = b.source_rows({"kind": "planet-rock", "genres": ["classics"], "maxYear": 1989, "maxPosition": 79}, html)
        self.assertEqual([(r["title"], r["position"]) for r in rows], [("Sultans of Swing", 79)])

    def test_genres_require_chart_rap_for_new_wave_and_russian_hints(self):
        config = {"newWaveArtists": ["OG Buda"], "russianArtists": ["OG Buda"]}
        source = {"kind": "apple-chart", "country": "ru", "genres": []}
        self.assertEqual(b.row_genres(source, {"artists": ["OG Buda"], "rawGenres": ["Hip-Hop/Rap"]}, config), ["ru-rap", "new-wave"])
        self.assertEqual(b.row_genres(source, {"artists": ["OG Buda"], "rawGenres": ["Pop"]}, config), ["ru-pop"])
        self.assertEqual(b.row_genres(source, {"artists": ["Eminem"], "rawGenres": ["Hip-Hop/Rap"]}, config), ["western-rap"])
        self.assertEqual(b.row_genres({"kind": "verified-tracks", "genres": ["classics"]}, {"artists": ["OG Buda"], "genres": ["ru-rap"]}, config), ["classics", "ru-rap", "new-wave"])

    def test_exact_identity_rejects_wrong_artist_and_unrequested_versions(self):
        row = {"title": "Sultans of Swing", "artists": ["Dire Straits"]}
        for candidate in [raw(artist="Dire Straits Tribute"), raw(title="Sultans of Swing (Live)"),
                          raw(title="Sultans of Swing - Remix"), raw(title="Sultans of Swing (Karaoke)"),
                          raw(title="Sultans of Swing (Sped Up)"), raw(title="Sultans of Swing (Instrumental)"),
                          raw(title="Sultans of Swing (Cover)"), raw(duration=12), raw(preview=""),
                          raw(title="Sultans of Swing Again"), raw(title_version="Live")]:
            with self.subTest(candidate=candidate):
                self.assertFalse(b.match_track(row, candidate)[0])
        self.assertTrue(b.match_track(row, raw(title="Sultans of Swing (2005 Remaster)", title_short="Sultans of Swing"))[0])
        self.assertTrue(b.match_track({"title": "Sultans of Swing (Live)", "artists": ["Dire Straits"]}, raw(title="Sultans of Swing (Live)"))[0])

    def test_credit_split_requires_exact_contributors(self):
        duet = raw(title="Song", artist="Alice", contributors=[{"id": 176, "name": "Alice"}, {"id": 9, "name": "Bob"}])
        self.assertTrue(b.match_track({"title": "Song", "artists": ["Alice & Bob"]}, duet)[0])
        self.assertFalse(b.match_track({"title": "Song", "artists": ["Alice & Bobby"]}, duet)[0])
        self.assertTrue(b.match_track({"title": "Song", "artists": ["Earth, Wind & Fire"]}, raw(title="Song", artist="Earth, Wind & Fire"))[0])

    def test_public_track_preserves_parallel_credit_pairs_for_namesakes(self):
        track = b.public_track(raw(artist="Same", contributors=[
            {"id": 176, "name": "Same"}, {"id": 9, "name": "Same"}, {"id": 10, "name": "Guest"}
        ]), {"title": "Sultans of Swing", "artists": ["Same"]})
        self.assertEqual(track["artistIds"], ["176", "9", "10"])
        self.assertEqual(track["artistNames"], ["Same", "Same", "Guest"])

    def test_collection_exclusions_remove_guests_only_from_requested_genre(self):
        track = {"artistIds": ["1", "2"], "artistNames": ["Core", "Loboda"], "artist": "Core, Loboda",
                 "genres": ["new-wave", "mom-pop"], "currentGenres": ["new-wave"],
                 "sources": [{"id": "a", "genres": ["new-wave", "mom-pop"]}]}
        b.apply_collection_rules([track], {"collectionExcludeArtists": {"new-wave": ["Loboda"]}})
        self.assertEqual(track["genres"], ["mom-pop"])
        self.assertEqual(track["currentGenres"], [])
        self.assertEqual(track["sources"][0]["genres"], ["mom-pop"])
        b.apply_collection_rules([track], {"artistDisplayNames": {"2": "Лобода"}})
        self.assertEqual(track["artistNames"], ["Core", "Лобода"])
        self.assertEqual(track["artistIds"], ["1", "2"])

    def test_collection_allowlist_preserves_a_fit_without_approving_guest_solos(self):
        fit = {"deezerId": 1, "workKey": "1|fit", "artistIds": ["1", "2"], "artistNames": ["Core", "Guest"], "genres": ["new-wave", "ru-rap"], "sources": [{"id": "s", "genres": ["new-wave", "ru-rap"]}]}
        solo = {"deezerId": 2, "workKey": "2|solo", "artistIds": ["2"], "artistNames": ["Guest"], "genres": ["new-wave", "ru-rap"], "sources": [{"id": "s", "genres": ["new-wave", "ru-rap"]}]}
        config = {"collectionTrackAllowlist": {"new-wave": {"ids": [1], "workKeys": ["1|fit"], "excludedIds": [], "excludedWorkKeys": []}}}
        b.apply_collection_rules([fit, solo], config)
        self.assertEqual(fit["genres"], ["new-wave", "ru-rap"])
        self.assertEqual(solo["genres"], ["ru-rap"])
        self.assertEqual(solo["sources"][0]["genres"], ["ru-rap"])

    def test_reviewed_rows_pin_artist_id_across_display_name_changes(self):
        row = {"title": "Sultans of Swing", "artists": ["Отображаемое имя"], "artistIds": [176]}
        self.assertTrue(b.match_track(row, raw())[0])
        self.assertFalse(b.match_track(row, raw(artist_id=999))[0])

    def test_verified_deezer_link_resolves_a_track_missing_from_search(self):
        class MissingFromSearch(FakeClient):
            def get(self, url):
                if "/search?" in url:
                    self.calls.append(url)
                    return {"data": []}
                return super().get(url)

        client = MissingFromSearch()
        row = {"title": "Sultans of Swing", "artists": ["Dire Straits"], "url": "https://www.deezer.com/track/10"}
        track, failure = b.resolve(row, client)
        self.assertIsNotNone(track)
        self.assertEqual(track["deezerId"], 10)
        self.assertIsNone(failure)
        self.assertEqual(client.calls, ["https://api.deezer.com/track/10"])

    def test_pinned_link_still_checks_identity_version_and_playability(self):
        row = {"title": "Sultans of Swing", "artists": ["Dire Straits"], "url": "https://www.deezer.com/track/11"}
        for wrong in [raw(11, artist="Tribute Band"), raw(11, title="Sultans of Swing (Live)"), raw(11, preview="")]:
            with self.subTest(wrong=wrong):
                client = FakeClient(tracks=[wrong, raw()])
                track, failure = b.resolve(row, client)
                self.assertEqual(track["deezerId"], 10)
                self.assertIsNone(failure)
                self.assertEqual(client.calls[0], "https://api.deezer.com/track/11")

    def test_source_link_cannot_select_a_different_host_or_protocol(self):
        for url in ["https://www.deezer.com.evil.test/track/10", "http://www.deezer.com/track/10", "https://user@www.deezer.com/track/10", "https://www.deezer.com/track/0"]:
            with self.subTest(url=url):
                client = FakeClient()
                track, _ = b.resolve({"title": "Sultans of Swing", "artists": ["Dire Straits"], "url": url}, client)
                self.assertEqual(track["deezerId"], 10)
                self.assertIn("/search?", client.calls[0])

    def setup_build(self, directory, sources):
        path = Path(directory) / "sources.json"
        path.write_text(json.dumps({"version": 1, "sources": sources}), encoding="utf-8")
        return path, Path(directory) / "catalog.json"

    def source(self, ident="rock", **extra):
        value = {"id": ident, "kind": "verified-tracks", "title": ident,
                 "url": "https://example.org/historical-chart", "genres": ["classics"],
                 "tracks": [{"title": "Sultans of Swing", "artists": ["Dire Straits"], "position": 79}]}
        value.update(extra)
        return value

    def test_artist_top_source_takes_popular_originals_and_tags_new_wave(self):
        hit = raw(20, "Династия", "madk1d", 501, isrc="RUA000000001")
        remix = raw(21, "Династия (Sped Up)", "madk1d", 501, isrc="RUA000000002")
        other = raw(22, "Свет", "madk1d", 501, isrc="RUA000000003")

        class ArtistClient(FakeClient):
            def get(self, url):
                self.calls.append(url)
                if url.startswith("https://api.deezer.com/search/artist?"):
                    return {"data": [{"id": 9, "name": "madk1d (tribute)", "nb_fan": 9999}, {"id": 501, "name": "madk1d", "nb_fan": 10}]} if "madk1d" in url else {"data": []}
                if url.startswith("https://api.deezer.com/artist/501/top"):
                    return {"data": [remix, hit, other]}
                return super().get(url)

        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [{"id": "ru-top", "kind": "deezer-artist-top", "title": "Deezer", "url": "https://www.deezer.com/",
                                                     "genres": ["ru-rap"], "perArtist": 2, "artists": ["madk1d", "Нет такого"]}])
            config = json.loads(src.read_text(encoding="utf-8"))
            config["newWaveArtists"] = ["madk1d"]
            src.write_text(json.dumps(config), encoding="utf-8")
            client = ArtistClient(tracks=[hit, remix, other])
            self.assertTrue(b.build(src, out, client=client))
            tracks = json.loads(out.read_text(encoding="utf-8"))["tracks"]
            self.assertEqual(sorted(t["title"] for t in tracks), ["Династия", "Свет"], "remixes and sped-up versions are skipped")
            self.assertTrue(all(t["genres"] == ["ru-rap", "new-wave"] for t in tracks))
            self.assertEqual(tracks[0]["sources"][0]["period"], "популярное у madk1d")

    def test_pinned_artist_id_skips_the_namesake_search(self):
        song = raw(40, "Square Hammer", "Ghost", 8506054, isrc="SE0000000040")

        class PinnedClient(FakeClient):
            def get(self, url):
                self.calls.append(url)
                if url.startswith("https://api.deezer.com/search/artist?"):
                    raise AssertionError("pinned artists must not be searched")
                if url.startswith("https://api.deezer.com/artist/8506054/top"):
                    return {"data": [song]}
                return super().get(url)

        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [{"id": "metal", "kind": "deezer-artist-top", "title": "Deezer", "url": "https://www.deezer.com/",
                                                     "genres": ["metal"], "artists": [{"name": "Ghost", "id": 8506054}]}])
            self.assertTrue(b.build(src, out, client=PinnedClient(tracks=[song])))
            self.assertEqual([t["title"] for t in json.loads(out.read_text(encoding="utf-8"))["tracks"]], ["Square Hammer"])

    def test_stop_list_drops_banned_artists_and_broken_recordings(self):
        guest = raw(30, "Сосед", "Каспийский Груз", 7, isrc="RUA000000030", contributors=[{"id": 7, "name": "Каспийский Груз"}, {"id": 8, "name": "Гера Джио"}])
        broken = raw(31, "Новая эра", "LOVV66", 9, isrc="RUA000000031")
        kept = raw(32, "Кукла колдуна", "Король и Шут", 11, isrc="RUA000000032")
        rows = [{"title": t["title"], "artists": [t["artist"]["name"]]} for t in (guest, broken, kept)]
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source(tracks=rows)])
            config = json.loads(src.read_text(encoding="utf-8"))
            config.update(excludeArtists=["каспийский груз"], excludeTracks=[31])
            src.write_text(json.dumps(config), encoding="utf-8")
            self.assertTrue(b.build(src, out, client=FakeClient(tracks=[guest, broken, kept])))
            self.assertEqual([t["title"] for t in json.loads(out.read_text(encoding="utf-8"))["tracks"]], ["Кукла колдуна"])

    def test_collection_artist_ids_reject_foreign_guests_even_from_recent_cache(self):
        guest = raw(31, "Duet", "Dire Straits", 176, isrc="GBABC7700031",
                    contributors=[{"id": 176, "name": "Dire Straits"}, {"id": 3, "name": "Snoop Dogg"}])
        rows = [{"title": t["title"], "artists": ["Dire Straits"]} for t in (raw(), guest)]
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source(tracks=rows), self.source("other", genres=["other"], tracks=rows)])
            self.assertTrue(b.build(src, out, client=FakeClient(tracks=[raw(), guest])))
            config = json.loads(src.read_text(encoding="utf-8"))
            config["sources"][0]["allowedArtistIds"] = [176]
            src.write_text(json.dumps(config), encoding="utf-8")
            self.assertTrue(b.build(src, out, client=FakeClient(tracks=[raw(), guest])))
            tracks = json.loads(out.read_text(encoding="utf-8"))["tracks"]
            self.assertEqual(next(t for t in tracks if t["deezerId"] == 31)["genres"], ["other"])
            self.assertEqual(next(t for t in tracks if t["deezerId"] == 10)["genres"], ["classics", "other"])

    def test_failed_editorial_source_cannot_restore_removed_songs_or_foreign_guests(self):
        guest = raw(31, "Duet", "Dire Straits", 176, isrc="GBABC7700031",
                    contributors=[{"id": 176, "name": "Dire Straits"}, {"id": 3, "name": "Snoop Dogg"}])
        removed = raw(32, "Removed", isrc="GBABC7700032")
        rows = [{"title": t["title"], "artists": ["Dire Straits"]} for t in (raw(), guest, removed)]
        class FailedLookup(FakeClient):
            def get(self, url):
                if "/search?" in url:
                    raise OSError("offline")
                return super().get(url)
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source(tracks=rows), self.source("other", genres=["other"], tracks=rows)])
            self.assertTrue(b.build(src, out, client=FakeClient(tracks=[raw(), guest, removed])))
            config = json.loads(src.read_text(encoding="utf-8"))
            config["sources"][0].update(allowedArtistIds=[176], tracks=rows[:2] + [{"title": "Unavailable", "artists": ["Dire Straits"]}])
            src.write_text(json.dumps(config), encoding="utf-8")
            self.assertTrue(b.build(src, out, client=FailedLookup(tracks=[raw(), guest, removed])))
            tracks = json.loads(out.read_text(encoding="utf-8"))["tracks"]
            self.assertEqual(next(t for t in tracks if t["deezerId"] == 10)["genres"], ["classics", "other"])
            for ident in (31, 32):
                self.assertEqual(next(t for t in tracks if t["deezerId"] == ident)["genres"], ["other"])

    def test_collection_artist_ids_must_be_positive_integer_ids(self):
        for value in ([True], ["176"], [0], [-1], []):
            with self.subTest(value=value), self.assertRaises(ValueError):
                b.validate_config({"version": 1, "sources": [self.source(allowedArtistIds=value)]})

    def test_merging_another_release_cannot_lend_excluded_guests_a_genre(self):
        guest = raw(31, contributors=[{"id": 176, "name": "Dire Straits"}, {"id": 3, "name": "Snoop Dogg"}])
        row = {"title": "Sultans of Swing", "artists": ["Dire Straits"]}
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [
                self.source("other", genres=["other"], tracks=[dict(row, url="https://www.deezer.com/track/31")]),
                self.source(allowedArtistIds=[176], tracks=[dict(row, url="https://www.deezer.com/track/10")]),
            ])
            self.assertTrue(b.build(src, out, client=FakeClient(tracks=[raw(), guest])))
            tracks = json.loads(out.read_text(encoding="utf-8"))["tracks"]
            self.assertEqual(len(tracks), 1)
            self.assertEqual(tracks[0]["genres"], ["other"])
            self.assertEqual([r["id"] for r in tracks[0]["sources"]], ["other"])

    def test_total_outage_applies_editorial_removals_to_saved_catalog(self):
        guest = raw(31, "Duet", isrc="GBABC7700031",
                    contributors=[{"id": 176, "name": "Dire Straits"}, {"id": 3, "name": "Snoop Dogg"}])
        rows = [{"title": t["title"], "artists": ["Dire Straits"]} for t in (raw(), guest)]
        class Offline(FakeClient):
            def get(self, url):
                raise OSError("offline")
        for remove_all in [False, True]:
            with self.subTest(remove_all=remove_all), workspace_temp() as directory:
                src, out = self.setup_build(directory, [self.source(tracks=rows)])
                self.assertTrue(b.build(src, out, client=FakeClient(tracks=[raw(), guest])))
                config = json.loads(src.read_text(encoding="utf-8"))
                config["sources"][0].update(allowedArtistIds=[176], tracks=[{"title": "Unavailable", "artists": ["Dire Straits"]}] if remove_all else rows[:1])
                src.write_text(json.dumps(config), encoding="utf-8")
                with patch.object(b, "recent", return_value=False):
                    self.assertTrue(b.build(src, out, client=Offline()))
                saved = json.loads(out.read_text(encoding="utf-8"))
                self.assertEqual([t["deezerId"] for t in saved["tracks"]], [] if remove_all else [10])
                self.assertEqual(saved["sources"][0]["status"], "stale")

    def test_build_merges_isrc_and_work_provenance_never_saves_preview(self):
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source(), self.source("pop", genres=["pop-rnb"], current=True)])
            client = FakeClient()
            self.assertTrue(b.build(src, out, client=client))
            catalog = json.loads(out.read_text())
            self.assertEqual(len(catalog["tracks"]), 1)
            track = catalog["tracks"][0]
            self.assertEqual(track["id"], "dz-10")
            self.assertEqual(track["answerKey"], "176|sultans of swing")
            self.assertEqual(track["genres"], ["classics", "pop-rnb"])
            self.assertEqual(track["currentGenres"], ["pop-rnb"])
            self.assertEqual([s["id"] for s in track["sources"]], ["rock", "pop"])
            self.assertNotIn("preview", out.read_text())
            self.assertTrue(any("/track/10" in call for call in client.calls))

    def test_dedup_different_ids_uses_both_isrc_and_canonical_work(self):
        first = b.public_track(raw(), {"title": "Sultans of Swing", "artists": ["Dire Straits"]})
        second = b.public_track(raw(11), {"title": "Sultans of Swing", "artists": ["Dire Straits"]})
        third = b.public_track(raw(12, isrc="OTHER"), {"title": "Sultans of Swing", "artists": ["Dire Straits"]})
        for track, genre in zip([first, second, third], ["classics", "alt-rock", "pop-rnb"]):
            track.update(genres=[genre], currentGenres=[], sources=[], lookupKeys=[genre])
        merged = b.merge_tracks([first, second, third])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["genres"], ["classics", "alt-rock", "pop-rnb"])

    def test_failed_source_preserves_old_provenance_but_success_refreshes(self):
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source(), self.source("pop", genres=["pop-rnb"])])
            self.assertTrue(b.build(src, out, client=FakeClient()))
            config = json.loads(src.read_text(encoding="utf-8"))
            config["sources"][0].update(kind="apple-playlist", url="https://example.org/down")
            src.write_text(json.dumps(config))
            self.assertTrue(b.build(src, out, client=FakeClient()))
            catalog = json.loads(out.read_text())
            self.assertEqual(catalog["sources"][0]["status"], "stale")
            self.assertEqual(len(catalog["tracks"][0]["sources"]), 2)

    def test_collection_removal_takes_effect_even_if_every_source_is_offline(self):
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source(genres=["new-wave", "mom-pop"])])
            self.assertTrue(b.build(src, out, client=FakeClient()))
            config = json.loads(src.read_text(encoding="utf-8"))
            config["collectionExcludeArtists"] = {"new-wave": ["Dire Straits"]}
            config["sources"][0].update(kind="apple-playlist", url="https://example.org/down")
            src.write_text(json.dumps(config), encoding="utf-8")
            self.assertTrue(b.build(src, out, client=FakeClient()))
            track = json.loads(out.read_text(encoding="utf-8"))["tracks"][0]
            self.assertEqual(track["genres"], ["mom-pop"])
            self.assertEqual(track["sources"][0]["genres"], ["mom-pop"])

    def test_all_sources_failed_and_zero_valid_do_not_replace_old_bytes(self):
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source()])
            self.assertTrue(b.build(src, out, client=FakeClient()))
            original = out.read_bytes()
            src.write_text(json.dumps({"version": 1, "sources": [self.source(kind="apple-playlist")]}))
            self.assertFalse(b.build(src, out, client=FakeClient()))
            self.assertEqual(out.read_bytes(), original)
            src.write_text(json.dumps({"version": 1, "sources": [self.source(tracks=[{"title": "Unmatched", "artists": ["Wrong"]}])]}))
            self.assertFalse(b.build(src, out, client=FakeClient()))
            self.assertEqual(out.read_bytes(), original)
            review = json.loads(out.with_name("review.json").read_text())
            self.assertEqual(review["counts"]["unmatched"], 1)
            self.assertTrue(review["unmatched"][0]["reason"])

    def test_recent_cache_refreshes_sources_but_avoids_deezer_requests(self):
        with workspace_temp() as directory:
            source = self.source(kind="apple-chart", current=True)
            src, out = self.setup_build(directory, [source])
            page = {"feed": {"results": [{"name": "Sultans of Swing", "artistName": "Dire Straits", "genres": [{"name": "Rock"}]}]}}
            self.assertTrue(b.build(src, out, client=FakeClient(pages={source["url"]: page})))
            second = FakeClient(pages={source["url"]: page})
            self.assertTrue(b.build(src, out, client=second))
            self.assertEqual(second.calls, [source["url"]])

    def test_empty_playlist_is_a_failed_source(self):
        with self.assertRaises(ValueError):
            b.source_rows({"kind": "apple-playlist"}, "<html>consent required</html>")

    def test_stale_source_does_not_reintroduce_removed_fresh_source_genres(self):
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source(), self.source("pop", genres=["pop-rnb"])])
            self.assertTrue(b.build(src, out, client=FakeClient()))
            src.write_text(json.dumps({"version": 1, "sources": [self.source(kind="apple-playlist"), self.source("pop", genres=["electronic"])]}))
            self.assertTrue(b.build(src, out, client=FakeClient()))
            track = json.loads(out.read_text())["tracks"][0]
            self.assertEqual(set(track["genres"]), {"classics", "electronic"})

    def test_cache_hits_do_not_extend_original_verification_date(self):
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source()])
            self.assertTrue(b.build(src, out, client=FakeClient()))
            review_path = out.with_name("review.json")
            review = json.loads(review_path.read_text())
            first_date = next(iter(review["matchCache"].values()))["verifiedAt"]
            with patch.object(b, "stamp", return_value="2090-01-01T00:00:00Z"):
                self.assertTrue(b.build(src, out, client=FakeClient()))
            review = json.loads(review_path.read_text())
            self.assertEqual(next(iter(review["matchCache"].values()))["verifiedAt"], first_date)
            for entry in review["matchCache"].values():
                entry["verifiedAt"] = "2000-01-01T00:00:00Z"
            review_path.write_text(json.dumps(review))
            client = FakeClient()
            self.assertTrue(b.build(src, out, client=client))
            self.assertTrue(any("/search?" in call for call in client.calls))

    def test_detail_validation_rejects_search_result_with_wrong_detail_id(self):
        class WrongDetail(FakeClient):
            def get(self, url):
                return raw(999) if "/track/" in url else super().get(url)
        track, failure = b.resolve({"title": "Sultans of Swing", "artists": ["Dire Straits"]}, WrongDetail())
        self.assertIsNone(track)
        self.assertIn("detail ID mismatch", failure["reason"])

    def test_partial_api_failure_retains_previous_source_recordings(self):
        class FailedDetail(FakeClient):
            def get(self, url):
                if "/search?" in url:
                    raise OSError("rate limited")
                return super().get(url)
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source(), self.source("pop", genres=["pop-rnb"])])
            self.assertTrue(b.build(src, out, client=FakeClient()))
            config = json.loads(src.read_text(encoding="utf-8"))
            config["sources"][0]["tracks"].append({"title": "New Song", "artists": ["Dire Straits"]})
            src.write_text(json.dumps(config))
            self.assertTrue(b.build(src, out, client=FailedDetail()))
            catalog = json.loads(out.read_text())
            self.assertEqual(catalog["sources"][0]["status"], "stale")
            self.assertEqual(catalog["tracks"][0]["id"], "dz-10")

    def test_atomic_replace_failure_preserves_existing_catalog(self):
        with workspace_temp() as directory:
            output = directory / "catalog.json"
            output.write_text('{"old":true}')
            with patch.object(b.os, "replace", side_effect=OSError("busy")):
                with self.assertRaises(OSError):
                    b.atomic_json(output, {"new": True})
            self.assertEqual(output.read_text(), '{"old":true}')
            self.assertEqual([p.name for p in directory.iterdir()], ["catalog.json"])

    def test_builder_bounds_rows_and_workers(self):
        rows = [{"title": "Song " + str(i), "artists": ["Band"]} for i in range(600)]
        source = self.source(tracks=rows, limit=800)
        self.assertEqual(len(b.source_rows(source)), 500)
        self.assertEqual(len(b.source_rows(source, limit_per_source=3)), 3)
        with workspace_temp() as directory:
            src, out = self.setup_build(directory, [self.source()])
            original = b.ThreadPoolExecutor
            sizes = []
            def executor(**kwargs):
                sizes.append(kwargs["max_workers"])
                return original(**kwargs)
            with patch.object(b, "ThreadPoolExecutor", side_effect=executor):
                self.assertTrue(b.build(src, out, workers=40, client=FakeClient()))
            self.assertEqual(sizes, [4])

    def test_public_client_retries_timeouts_and_rate_limits(self):
        class Response(io.BytesIO):
            headers = Message()
        class Opener:
            attempts = 0
            def open(self, request, timeout):
                self.attempts += 1
                if self.attempts == 1:
                    raise URLError("timed out")
                if self.attempts == 2:
                    raise HTTPError(request.full_url, 429, "slow down", {"Retry-After": "1"}, io.BytesIO())
                return Response(b'{"data":[]}')
        client = b.Client()
        client.opener = Opener()
        with patch.object(b.time, "sleep") as sleep:
            self.assertEqual(client.get("https://api.deezer.com/search?q=test"), {"data": []})
        self.assertEqual(client.opener.attempts, 3)
        self.assertTrue(sleep.called)

    def test_chart_collaboration_uses_only_verified_contributors_for_taxonomy(self):
        source = self.source(kind="apple-chart", country="ru", current=True)
        row = {"title": "Song", "artists": ["OG Buda & Friend"], "rawGenres": ["Hip-Hop/Rap"]}
        config = {"russianArtists": ["OG Buda"], "newWaveArtists": ["OG Buda"]}
        self.assertEqual(b.row_genres(source, row, config, verified_names=["OG Buda", "Friend"]), ["ru-rap", "new-wave"])

    def test_russian_origin_is_independent_of_chart_country(self):
        config = {"russianArtists": ["OG Buda"], "newWaveArtists": ["OG Buda"]}
        row = {"artists": ["OG Buda"], "rawGenres": ["Hip-Hop/Rap"]}
        self.assertEqual(b.row_genres({"kind": "apple-chart", "country": "us"}, row, config), ["ru-rap", "new-wave"])
        self.assertEqual(b.row_genres({"kind": "apple-playlist", "genres": ["ru-rap"]}, row, config), ["ru-rap", "new-wave"])

    def test_chart_provenance_has_row_genres_and_upstream_date(self):
        with workspace_temp() as directory:
            source = self.source(kind="apple-chart", current=True)
            src, out = self.setup_build(directory, [source])
            feed = {"feed": {"updated": "2026-01-02T12:30:00Z", "results": [{"name": "Sultans of Swing", "artistName": "Dire Straits", "genres": [{"name": "Rock"}]}]}}
            self.assertTrue(b.build(src, out, client=FakeClient(pages={source["url"]: feed})))
            data = json.loads(out.read_text())
            self.assertEqual(data["sources"][0]["updatedAt"], "2026-01-02T12:30:00Z")
            self.assertEqual(data["tracks"][0]["sources"][0]["genres"], ["alt-rock"])

    def test_localized_chart_genres(self):
        config = {"russianArtists": ["madk1d"], "newWaveArtists": ["madk1d"]}
        source = {"kind": "apple-chart", "country": "ru"}
        for raw_genre, expected in [("Хип-хоп/рэп", ["ru-rap", "new-wave"]), ("Поп", ["ru-pop"]),
                                    ("Рок", ["ru-rock"]), ("Альтернатива", ["ru-rock"]),
                                    ("Танцевальная", ["electronic"]), ("Электроника", ["electronic"])]:
            with self.subTest(genre=raw_genre):
                self.assertEqual(b.row_genres(source, {"artists": ["madk1d"], "rawGenres": [raw_genre]}, config), expected)

    def test_chart_rfc_date_is_kept_as_upstream_time(self):
        self.assertEqual(b.upstream_date({"feed": {"updated": "Thu, 22 Oct 2026 01:15:14 +0000"}}, "fallback"), "2026-10-22T01:15:14Z")


class ServeTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(serve, "serve implementation must exist")

    def test_server_refreshes_old_catalog_but_keeps_recent_file(self):
        with workspace_temp() as directory:
            catalog = directory / "catalog.json"
            catalog.write_text(json.dumps({"generatedAt": b.stamp()}))
            with patch.object(serve, "build", return_value=True) as builder:
                self.assertFalse(serve.refresh_if_due(directory / "sources.json", catalog))
                builder.assert_not_called()
                catalog.write_text('{"generatedAt":"2000-01-01T00:00:00Z"}')
                self.assertTrue(serve.refresh_if_due(directory / "sources.json", catalog))
                self.assertEqual(builder.call_count, 1)

    def test_one_background_loop_runs_once_until_next_hour(self):
        stop = threading.Event()
        calls = []
        def refresh(*args):
            calls.append(args)
            stop.set()
        with patch.object(serve, "refresh_if_due", side_effect=refresh):
            serve.refresh_loop(Path("sources.json"), Path("catalog.json"), stop)
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
