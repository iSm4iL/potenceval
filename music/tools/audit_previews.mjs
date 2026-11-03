// Live audit only: downloads fresh previews and decodes them, never deletes catalog data.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PACKS } from '../catalog.js';
import { selectCollection } from '../collection.js';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RATE = 8000;
export function inspectPcm(bytes, minDuration = 15) {
  const samples = Math.floor(bytes.length / 4), duration = samples / RATE;
  if (!samples) return { status:'decode', duration:0 };
  let peak = 0;
  for (let i = 0; i < samples; i++) peak = Math.max(peak, Math.abs(bytes.readFloatLE(i * 4)));
  if (!Number.isFinite(peak)) return {status:'decode', duration};
  if (duration < minDuration) return {status:'too_short', duration, peak};
  if (peak < .00001) return {status:'silent', duration, peak};
  return {status:'playable', duration, peak};
}
const permanent = new Set(['no_track','no_preview','invalid_preview','http403','http404','http410','cors','decode','too_short','silent']);
export const confirmedFailure = attempts => !attempts.some(a => a.status === 'playable') && attempts.length >= 2
  && attempts.slice(-2).every(a => permanent.has(a.status)) && attempts.at(-1).status === attempts.at(-2).status;

const sleep = ms => new Promise(r=>setTimeout(r,ms));
function decode(input, minDuration = 15) {
  return new Promise(resolveResult => {
    const child = spawn('ffmpeg', ['-hide_banner','-nostdin','-v','error','-i',Buffer.isBuffer(input)?'pipe:0':input,'-map','0:a:0','-ac','1','-ar',String(RATE),'-f','f32le','pipe:1'], {windowsHide:true});
    const chunks = []; let error = '', settled = false;
    const done = value => { if (!settled) {settled=true;clearTimeout(timer);resolveResult(value);} };
    const timer = setTimeout(()=>{child.kill();done({status:'transient', reason:'decoder_timeout'});},20000);
    child.stdout.on('data', b=>chunks.push(b)); child.stderr.on('data', b=>{if(error.length<600)error+=b;});
    child.on('error', e=>done({status:'transient',reason:e.message}));
    child.on('close', code=>done(code === 0 ? inspectPcm(Buffer.concat(chunks),minDuration) : {status:'decode',reason:error.slice(0,300)}));
    child.stdin.on('error',()=>{});
    child.stdin.end(Buffer.isBuffer(input)?input:undefined);
  });
}

async function request(url, headers = {}) {
  const response = await fetch(url,{headers:{'User-Agent':'potenceval-audio-audit/1.0',...headers},signal:AbortSignal.timeout(15000),cache:'no-store'});
  if (response.status === 429) {
    const retry = response.headers.get('retry-after');
    await response.body?.cancel();
    throw new Error('Rate limited; stop and respect Retry-After: ' + (retry || 'unspecified'));
  }
  return response;
}
let nextApi = 0;
async function freshTrack(id, minDuration) {
  const slot = Math.max(nextApi, Date.now());nextApi = slot + 140;
  if(slot>Date.now())await sleep(slot-Date.now());
  const response = await request(`https://api.deezer.com/track/${id}`);
  if(!response.ok){await response.body?.cancel();return {status:'transient',reason:'metadata_http_'+response.status};}
  const data = await response.json();
  if(data.error){
    if(data.error.code === 800)return {status:'no_track',reason:data.error.message};
    throw new Error('Deezer metadata error '+JSON.stringify(data.error));
  }
  if(Number(data.id)!==id)return {status:'transient',reason:'metadata_wrong_id'};
  if(!data.preview)return {status:'no_preview'};
  let url;try{url=new URL(data.preview);}catch{return {status:'invalid_preview'};}
  if(url.protocol!=='https:'||!url.hostname.endsWith('.dzcdn.net'))return {status:'invalid_preview'};
  const audio = await request(url, {Origin:'https://potenceval.com'});
  if(!audio.ok){await audio.body?.cancel();return {status:[403,404,410].includes(audio.status)?'http'+audio.status:'transient',reason:'audio_http_'+audio.status};}
  const cors = audio.headers.get('access-control-allow-origin');
  if(cors!=='*'&&cors!=='https://potenceval.com'){await audio.body?.cancel();return {status:'cors',reason:'missing_allowed_origin'};}
  const bytes = Buffer.from(await audio.arrayBuffer());
  if(bytes.length>12*1024*1024)return {status:'transient',reason:'unexpected_large_preview'};
  return {...await decode(bytes,minDuration),bytes:bytes.length};
}

function inventory() {
  const catalog = JSON.parse(readFileSync('music/data/catalog.json', 'utf8'));
  const songs = new Map();
  for (const pack of PACKS) for (const track of selectCollection(catalog, pack.id).tracks) {
    if (!songs.has(track.deezerId)) songs.set(track.deezerId, { id: track.deezerId, title: track.artist + ' — ' + track.title, sources: [], minDuration: 15 });
    songs.get(track.deezerId).sources.push(pack.id);
  }
  return [...songs.values()];
}
async function main() {
  const limitArg=process.argv.find(a=>a.startsWith('--limit='));
  const limit=limitArg?Number(limitArg.split('=')[1]):Infinity;
  const reportPath='output/music-preview-audit'+(limitArg?'-pilot':'')+'.json';
  mkdirSync('output',{recursive:true});
  const entries=inventory().slice(0,limit);
  let previous;try{previous=JSON.parse(readFileSync(reportPath,'utf8'));}catch{}
  const current = new Map(entries.map(e=>[e.id,e]));
  const recent = previous?.checkedAt && Date.now()-Date.parse(previous.checkedAt)<6*60*60*1000;
  const results=new Map((recent?previous.results:[]).filter(r=>current.has(r.id)).map(r=>{
    const item=current.get(r.id);
    return [r.id,{...r,...item,attempts:r.attempts.map(a=>a.status==='playable'&&a.duration<item.minDuration?{...a,status:'too_short'}:a)}];
  }));
  let stopped = false, failure;
  const status = () => ({checked:results.size,total:entries.length,playable:[...results.values()].filter(r=>r.attempts.some(a=>a.status==='playable')).length,recheck:[...results.values()].filter(r=>!r.attempts.some(a=>a.status==='playable')).length});
  const save = () => writeFileSync(reportPath,JSON.stringify({checkedAt:new Date().toISOString(),...status(),results:[...results.values()]},null,2)+'\n');
  async function run(list, retry = false) {
    let index=0;
    await Promise.all(Array.from({length:4},async()=>{
      while(index<list.length&&!stopped){
        const item=list[index++];if(!retry&&results.has(item.id))continue;
        let result;
        try{result=await freshTrack(item.id,item.minDuration);}catch(e){
          if(/Rate limited|Deezer metadata error/.test(e.message)){stopped=true;failure=e.message;break;}
          result={status:'transient',reason:e.cause?.code||e.name||e.message};
        }
        const row=results.get(item.id)||{...item,attempts:[]};row.attempts.push({...result,at:new Date().toISOString()});results.set(item.id,row);
        if(results.size%100===0&&!retry){save();console.log(JSON.stringify(status()));}
      }
    }));save();if(stopped)throw Error(failure);
  }
  console.log(JSON.stringify({action:'audit',...status()}));
  await run(entries);
  const bad=()=>entries.filter(e=>!results.get(e.id)?.attempts.some(a=>a.status==='playable'));
  if(bad().length){console.log('Fresh-link recheck: '+bad().length);await sleep(5000);await run(bad(),true);}
  if(bad().some(e=>!confirmedFailure(results.get(e.id).attempts))){await sleep(5000);await run(bad().filter(e=>!confirmedFailure(results.get(e.id).attempts)),true);}
  const report={checkedAt:new Date().toISOString(),...status(),confirmed:[...results.values()].filter(r=>confirmedFailure(r.attempts)).map(r=>r.id),unresolved:[...results.values()].filter(r=>!r.attempts.some(a=>a.status==='playable')&&!confirmedFailure(r.attempts)).map(r=>r.id),results:[...results.values()]};
  writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({report:reportPath,...status(),confirmed:report.confirmed.length,unresolved:report.unresolved.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
