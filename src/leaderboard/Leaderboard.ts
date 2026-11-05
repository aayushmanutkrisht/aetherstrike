/** Browser-local run archive. No remote service or account is required. */
export interface ScoreEntry {
  id: string;
  player: string;
  score: number;
  accuracy: number;
  hits: number;
  shots: number;
  sectors: number;
  totalSectors: number;
  result: 'victory'|'defeat';
  playedAt: string;
}
export type FinishedRun = Omit<ScoreEntry,'id'|'playedAt'>;
export interface ScoreStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
export const SCORES_KEY='aether-strike:leaderboard:v1';
export const PLAYER_KEY='aether-strike:player:v1';
export const SCORE_LIMIT=150;
const getStorage=():ScoreStorage|undefined=>{
  try{return typeof window==='undefined'?undefined:window.localStorage;}
  catch{return undefined;}
};
const numberBetween=(value:unknown,min:number,max:number):number=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):min;
export const normalizeName=(raw:string)=>raw.replace(/[\u0000-\u001F\u007F<>]/g,'').replace(/\s+/g,' ').trim().slice(0,20);
export const validName=(raw:string)=>normalizeName(raw).length>=2;
export const readName=(storage:ScoreStorage|undefined=getStorage()):string=>{
  try{return normalizeName(storage?.getItem(PLAYER_KEY)??'');}catch{return '';}
};
export const saveName=(name:string,storage:ScoreStorage|undefined=getStorage()):boolean=>{
  const cleaned=normalizeName(name);
  if(!validName(cleaned))return false;
  try{storage?.setItem(PLAYER_KEY,cleaned);return !!storage;}catch{return false;}
};
function isRecord(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v);}
function parseEntry(raw:unknown):ScoreEntry|null{
  if(!isRecord(raw)||typeof raw.player!=='string'||typeof raw.id!=='string'||typeof raw.playedAt!=='string'||
     !validName(raw.player)||(raw.result!=='victory'&&raw.result!=='defeat')||!Number.isFinite(Date.parse(raw.playedAt)))return null;
  return {id:raw.id.slice(0,100),player:normalizeName(raw.player),
    score:Math.round(numberBetween(raw.score,0,100_000_000)),accuracy:Math.round(numberBetween(raw.accuracy,0,100)),
    hits:Math.round(numberBetween(raw.hits,0,100_000)),shots:Math.round(numberBetween(raw.shots,0,100_000)),
    sectors:Math.round(numberBetween(raw.sectors,0,100)),totalSectors:Math.round(numberBetween(raw.totalSectors,1,100)),
    result:raw.result,playedAt:raw.playedAt};
}
export const sortTopScores=(entries:ScoreEntry[]):ScoreEntry[]=>[...entries].sort((a,b)=>
  b.score-a.score||Number(b.result==='victory')-Number(a.result==='victory')||
  b.sectors-a.sectors||b.accuracy-a.accuracy||b.playedAt.localeCompare(a.playedAt));
/** Ranked view shows each player's personal best; full run history is kept separately. */
export function topPlayers(entries:ScoreEntry[],limit=10):ScoreEntry[]{
  const seen=new Set<string>();
  return sortTopScores(entries).filter(entry=>{
    const key=entry.player.toLocaleLowerCase();if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,limit);
}
export function readScores(storage:ScoreStorage|undefined=getStorage()):ScoreEntry[]{
  if(!storage)return [];
  try{
    const raw=storage.getItem(SCORES_KEY);if(!raw)return [];
    const parsed:unknown=JSON.parse(raw);
    return Array.isArray(parsed)?parsed.map(parseEntry).filter((v):v is ScoreEntry=>v!==null)
      .sort((a,b)=>b.playedAt.localeCompare(a.playedAt)).slice(0,SCORE_LIMIT):[];
  }catch{return [];}
}
export function addScore(run:FinishedRun,storage:ScoreStorage|undefined=getStorage()):{entries:ScoreEntry[];saved:boolean}{
  const player=normalizeName(run.player);
  if(!validName(player))throw new Error('Enter a name with at least 2 characters before playing.');
  const entry:ScoreEntry={...run,player,
    score:Math.round(numberBetween(run.score,0,100_000_000)),
    accuracy:Math.round(numberBetween(run.accuracy,0,100)),
    hits:Math.round(numberBetween(run.hits,0,100_000)),shots:Math.round(numberBetween(run.shots,0,100_000)),
    sectors:Math.round(numberBetween(run.sectors,0,100)),
    totalSectors:Math.round(numberBetween(run.totalSectors,1,100)),
    id:`${Date.now()}-${Math.random().toString(36).slice(2,12)}`,playedAt:new Date().toISOString()};
  const entries=[entry,...readScores(storage)].slice(0,SCORE_LIMIT);
  try{if(!storage)return {entries,saved:false};storage.setItem(SCORES_KEY,JSON.stringify(entries));return {entries,saved:true};}
  catch{return {entries,saved:false};}
}
export function clearScores(storage:ScoreStorage|undefined=getStorage()):boolean{
  try{if(!storage)return false;storage.removeItem(SCORES_KEY);return true;}catch{return false;}
}
export function scoresToCSV(entries:ScoreEntry[]):string{
  // Neutralize spreadsheet formula triggers in exported names.
  const quote=(s:string)=>`"${(/^[=+\-@]/.test(s)?'\'': '')+s.replace(/"/g,'""')}"`;
  return ['Player,Score,Accuracy (%),Hits,Shots,Sector,Total Sectors,Result,Played At',
    ...entries.map(e=>[quote(e.player),e.score,e.accuracy,e.hits,e.shots,e.sectors,e.totalSectors,e.result,e.playedAt].join(','))].join('\r\n');
}
