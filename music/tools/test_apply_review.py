import json
from pathlib import Path
import unittest
import apply_review as r


class ReviewTests(unittest.TestCase):
    def test_legacy_guest_flags_do_not_expand_guest_or_rejected_artists(self):
        tracks = [
            {"id": "dz-1", "deezerId": 1, "title": "Fit", "artistIds": ["1", "2"], "artistNames": ["Core", "Guest"], "workKey": "1|fit", "genres": ["test"]},
            {"id": "dz-2", "deezerId": 2, "title": "Solo", "artistIds": ["1"], "artistNames": ["Core"], "workKey": "1|solo", "genres": ["test"]},
            {"id": "dz-3", "deezerId": 3, "title": "No", "artistIds": ["3"], "artistNames": ["Rejected"], "workKey": "3|no", "genres": ["test"]},
        ]
        data = {"collections": [{"id": "test", "title": "Test", "tracks": tracks}]}
        state = {"version": 1, "tracks": {"test": {"dz-1": {"status": "keep", "more": True}, "dz-2": {"status": "keep", "more": True}, "dz-3": {"status": "remove", "more": True}}},
                 "artists": {"test": {"core": {"more": True}, "guest": {"more": True, "status": "remove"}, "rejected": {"more": True}}}}
        plan = r.make_plan(data, state, {"tracks": tracks})
        pack = plan[0]
        self.assertEqual(pack["allowedIds"], [1, 2])
        self.assertEqual([p["name"] for p in pack["requests"]], ["Core"])
        self.assertEqual({p["name"] for p in pack["skipped"]}, {"Guest", "Rejected"})

    def test_new_intent_version_can_request_an_artist_independently_of_fit_flags(self):
        track = {"id": "dz-1", "deezerId": 1, "title": "Fit", "artistIds": ["1", "2"], "artistNames": ["Core", "Guest"], "workKey": "1|fit", "genres": ["test"]}
        data = {"collections": [{"id": "test", "title": "Test", "tracks": [track]}]}
        state = {"version": 1, "intentVersion": 2, "tracks": {"test": {"dz-1": {"status": "keep"}}}, "artists": {"test": {"guest": {"more": True, "status": "remove"}}}}
        self.assertEqual(r.make_plan(data, state, {"tracks": [track]})[0]["requests"][0]["name"], "Guest")

    def test_html_is_read_only_as_json_and_unknown_ids_are_rejected(self):
        text = '<script>throw new Error("Do not execute this")</script><script id="review-catalog">{"collections":[]}</script><script id="review-state">{"version":1,"tracks":{},"artists":{}}</script>'
        data, state = r.parse_review(text)
        self.assertEqual(data["collections"], [])
        self.assertEqual(state["version"], 1)
        data["collections"] = [{"id": "test", "tracks": [{"id": "dz-999", "deezerId": 999}]}]
        with self.assertRaises(ValueError):
            r.make_plan(data, state, {"tracks": []})


if __name__ == '__main__':
    unittest.main()
