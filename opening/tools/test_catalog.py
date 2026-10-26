import copy
import json
import pathlib
import unittest
from check_catalog import validate

CATALOG = pathlib.Path(__file__).resolve().parents[1] / 'data' / 'catalog.json'

class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.catalog = json.loads(CATALOG.read_text(encoding='utf-8'))

    def test_valid_catalog(self):
        self.assertEqual(validate(self.catalog), [])
        self.assertGreaterEqual(len(self.catalog['entries']), 30)

    def test_duplicate_ids_rejected(self):
        self.catalog['entries'].append(copy.deepcopy(self.catalog['entries'][0]))
        errors = ' '.join(validate(self.catalog))
        self.assertIn('duplicate animeId', errors)
        self.assertIn('duplicate trackId', errors)

    def test_unknown_and_insufficient_distractors_rejected(self):
        self.catalog['entries'][0]['distractorIds'] = ['missing', 'oshi']
        errors = ' '.join(validate(self.catalog))
        self.assertIn('unknown distractor', errors)
        self.assertIn('three distractors', errors)

    def test_missing_fields_and_unsafe_urls_rejected(self):
        del self.catalog['entries'][0]['artist']
        self.catalog['entries'][0]['poster'] = 'javascript:alert(1)'
        errors = ' '.join(validate(self.catalog))
        self.assertIn('missing artist', errors)
        self.assertIn('poster URL', errors)

if __name__ == '__main__': unittest.main()
