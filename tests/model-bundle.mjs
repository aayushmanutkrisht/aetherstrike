import assert from 'node:assert/strict';
import {isPlausibleTaskFile,hasPlausibleLocalHandModel,modelCandidates,OFFICIAL_HAND_MODEL} from '../src/tracking/ModelBundle.ts';
// Regression: v1.5.1 overvalidated ZIP structure, rejecting some real task
// buffers before MediaPipe could parse them. Only check basic binary shape.
const realisticZipHeader=new Uint8Array(7500000);
realisticZipHeader.set([0x50,0x4b,0x03,0x04]);
assert.equal(isPlausibleTaskFile(realisticZipHeader),true);
const tflite=new Uint8Array(7500000);
tflite.set([84,70,76,51],4);
assert.equal(isPlausibleTaskFile(tflite),true);
assert.equal(isPlausibleTaskFile(new TextEncoder().encode('<html>vite fallback</html>')),false);
assert.equal(isPlausibleTaskFile(new Uint8Array(500_000)),false);
assert.deepEqual(modelCandidates('/mediapipe/hand_landmarker.task',false),[OFFICIAL_HAND_MODEL]);
assert.deepEqual(modelCandidates('/mediapipe/hand_landmarker.task',true),['/mediapipe/hand_landmarker.task',OFFICIAL_HAND_MODEL]);
const originalFetch=globalThis.fetch;
try{
  globalThis.fetch=async()=>new Response('<!DOCTYPE html><title>Vite</title>',{status:200,headers:{'content-type':'text/html'}});
  assert.equal(await hasPlausibleLocalHandModel('/mediapipe/hand_landmarker.task'),false);
  globalThis.fetch=async()=>new Response(realisticZipHeader,{status:200,headers:{'content-type':'application/octet-stream'}});
  assert.equal(await hasPlausibleLocalHandModel('/mediapipe/hand_landmarker.task'),true);
  globalThis.fetch=async()=>new Response('Not Found',{status:404});
  assert.equal(await hasPlausibleLocalHandModel('/mediapipe/hand_landmarker.task'),false);
}finally{globalThis.fetch=originalFetch;}
console.log('PASS: local HTML/404 rejected; binary task candidates admitted; official URL fallback retained');
