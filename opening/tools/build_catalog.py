"""Build metadata only from manually reviewed original recordings."""
import datetime
import json
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
APPROVED = {
 'oshi':2287882757,'gurren':975986452,'dandadan':3024903811,'mashle':2580253682,
 'chainsaw':1946911957,'jujutsu':1143848452,'attack':472698952,'demon':1093334492,
 'naruto':121134202,'bleach':975900332,'onepiece':3033808841,'deathnote':2665292552,
 'tokyo':975968052,'onepunch':2767184121,'fullmetal':975952742,'eva':1143838252,
 'geass':976202432,'sao':976378422,'noragami':3618414102,'fireforce':711676642,
 'haikyuu':1439536642,'bluelock':1951233967,'frieren':2449469235,'spy':1701852587,
 'kaguya':976086872,'lie':976093942,'bunny':975905312,'bocchi':1922480887,
 'konosuba':2524728881,'rezero':2358580505,'nogame':2809886802,
 'parasyte':2665262552,'erased':1100590722,
}
def read(name):
 return json.loads((ROOT/'data'/name).read_text(encoding='utf-8-sig'))
def main():
 seeds=read('seeds.json')
 anime={x['idMal']:x for x in read('anime-metadata.json')}
 tracks={x['key']:{t['id']:t for t in x['tracks']} for x in read('recording-candidates.json')}
 date=datetime.date.today().isoformat()
 entries=[]
 for key,ru,mal,title,artist,_,distractors in seeds:
  if key not in APPROVED: continue
  meta=anime[mal];track=tracks[key][APPROVED[key]]
  if key=='haikyuu': distractors='bluelock naruto onepunch mashle fireforce'
  if key=='bluelock': distractors='haikyuu naruto onepunch mashle fireforce'
  if key=='onepunch': distractors='mashle gurren dandadan fireforce naruto'
  entries.append({
   'animeId':key,'titleRu':ru,'titleOriginal':meta['title']['romaji'],
   'franchiseId':key,'genres':meta['genres'],'moodTags':meta['genres'][:3],
   'poster':meta['coverImage']['extraLarge'],'posterSource':meta['siteUrl'],
   'posterCredit':'AniList; artwork copyright respective rights holders',
   'trackId':track['id'],'trackTitle':track['title'],'artist':track['artist']['name'],
   'artistId':track['artist']['id'],'distractorIds':[i for i in distractors.split() if i in APPROVED],
   'themeSource':f'https://myanimelist.net/anime/{mal}','themeTitle':title,'checkedAt':date,
  })
 (ROOT/'data'/'catalog.json').write_text(json.dumps({'version':1,'checkedAt':date,'sources':['https://docs.anilist.co/','https://api.deezer.com/'],'entries':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(f'Built {len(entries)} reviewed anime openings; no audio stored.')
if __name__=='__main__': main()
