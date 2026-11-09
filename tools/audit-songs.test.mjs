import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPcm,confirmedFailure} from './audit-songs.mjs';
test('audio audit distinguishes decodable sound from silence and too-short snippets',()=>{
  const pcm=Buffer.alloc(16*8000*4);
  for(let i=0;i<16*8000;i++)pcm.writeFloatLE(Math.sin(i/8)*.2,i*4);
  assert.equal(inspectPcm(pcm).status,'playable');
  assert.equal(inspectPcm(pcm.subarray(0,14*8000*4)).status,'too_short');
  assert.equal(inspectPcm(Buffer.alloc(pcm.length)).status,'silent');
  assert.equal(inspectPcm(Buffer.alloc(0)).status,'decode');
});
test('transient failures, single failures and a successful retry never justify removal',()=>{
  const attempts=(...statuses)=>statuses.map(status=>({status}));
  assert.equal(confirmedFailure(attempts('http404','http404')),true);
  for(const states of [['http404'],['http404','playable'],['transient','transient'],['no_preview','transient'],['http403','http404']])assert.equal(confirmedFailure(attempts(...states)),false);
});
