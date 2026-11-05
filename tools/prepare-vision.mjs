/** Cache MediaPipe runtime and optionally the official hand model locally.
 * Do not attempt to parse a .task ZIP central directory: the real MediaPipe
 * runtime determines compatibility. Do not delete model files based on a
 * made-up ZIP-layout requirement (the v1.5.1 regression).
 */
import {mkdir,copyFile,readdir,stat,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'public','mediapipe');
const source=path.join(root,'node_modules','@mediapipe','tasks-vision','wasm');
await mkdir(output,{recursive:true});
try {
  const files=(await readdir(source)).filter(n=>/\.(js|wasm)$/.test(n));
  if(!files.length)throw new Error('MediaPipe WASM directory is empty');
  await Promise.all(files.map(async name=>copyFile(path.join(source,name),path.join(output,name))));
  console.log(`MediaPipe: copied ${files.length} runtime files to public/mediapipe/`);
} catch(error){console.warn(`MediaPipe WASM copy skipped: ${error.message}`);}
const modelPath=path.join(output,'hand_landmarker.task');
function plausibleModel(b){
  if(b.length<500_000 || b.length>30_000_000)return false;
  return (b[0]===0x50&&b[1]===0x4b) || b.toString('ascii',4,8)==='TFL3';
}
let cached=false;
try {
  const b=await readFile(modelPath);
  cached=plausibleModel(b);
  if(!cached)console.warn('MediaPipe: existing hand_landmarker.task looks invalid. Will try official download (existing file is not overwritten unless download succeeds).');
} catch { /* no cached model */ }
if (!cached) {
  const url='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  const temp=`${modelPath}.part`;
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(!plausibleModel(bytes))throw new Error('Response is not a plausible MediaPipe task model (possibly HTML)');
    await writeFile(temp,bytes);
    await rename(temp,modelPath);
    console.log(`MediaPipe: cached hand model (${(bytes.length/1048576).toFixed(1)} MiB)`);
  } catch(error) {
    await rm(temp,{force:true});
    console.warn(`MediaPipe: optional model cache not available (${error.message}). The game will use the official URL directly as in v1.4.`);
  }
} else {
  const info=await stat(modelPath);
  console.log(`MediaPipe: found local hand model (${(info.size/1048576).toFixed(1)} MiB)`);
}
