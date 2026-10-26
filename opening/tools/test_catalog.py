import copy
import json
import pathlib
import unittest
from check_catalog import validate
from build_catalog import assemble

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

    def test_assembler_keeps_categories_separate_and_excludes_same_franchise(self):
        base = self.catalog['entries'][0]
        anime = [{**base, 'animeId':f'a{i}', 'franchiseId':f'a{i}', 'trackId':100+i, 'category':'anime', 'distractorIds':[]} for i in range(5)]
        films = [{**base, 'animeId':f'f{i}', 'franchiseId':f'f{i}', 'trackId':200+i, 'category':'film', 'distractorIds':[]} for i in range(5)]
        films[1]['franchiseId'] = 'f0'
        data = assemble([anime, films])
        by_id = {e['animeId']:e for e in data['entries']}
        self.assertNotIn('f1', by_id['f0']['distractorIds'])
        for e in data['entries']:
            self.assertGreaterEqual(len(e['distractorIds']),3)
            self.assertTrue(all(by_id[i]['category']==e['category'] for i in e['distractorIds']))

    def test_assembler_rejects_duplicate_recording_instead_of_inflating_catalog(self):
        entry = self.catalog['entries'][0]
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            assemble([[entry, {**entry,'animeId':'duplicate-film','category':'film'}]])

    def test_disabled_short_preview_is_not_published_or_used_as_an_answer(self):
        base = self.catalog['entries'][0]
        source = [{**base,'animeId':f'a{i}','franchiseId':f'a{i}','trackId':1000+i,'distractorIds':[]} for i in range(6)]
        source[0]['disabledReason'] = 'Preview shorter than 29.5 seconds'
        data = assemble([source])
        self.assertEqual(len(data['entries']),5)
        self.assertTrue(all(e['animeId']!='a0' and 'a0' not in e['distractorIds'] for e in data['entries']))

if __name__ == '__main__': unittest.main()
