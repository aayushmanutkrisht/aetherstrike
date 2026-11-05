import {useState} from 'react';
import {Award,Clock3,Download,ShieldCheck,ShieldX,Trash2,Trophy} from 'lucide-react';
import {type ScoreEntry,topPlayers} from '../leaderboard/Leaderboard';

type Props={entries:ScoreEntry[];player:string;onClear:()=>void;onExport:()=>void};
function readableTime(iso:string){
  try{return new Date(iso).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
  catch{return iso;}
}
export function LeaderboardPanel({entries,player,onClear,onExport}:Props){
  const [tab,setTab]=useState<'best'|'log'>('best');
  const [confirmClear,setConfirmClear]=useState(false);
  const rows=tab==='best'?topPlayers(entries,10):entries.slice(0,150);
  const personalBest=topPlayers(entries,150).find(e=>e.player.toLocaleLowerCase()===player.toLocaleLowerCase());
  return <div className="leaderboard-body">
    <div className="leaderboard-summary">
      <div><Trophy size={19}/><span>TOP OPERATIVE</span><strong>{topPlayers(entries,1)[0]?.player??'—'}</strong></div>
      <div><Award size={19}/><span>YOUR BEST</span><strong>{personalBest?personalBest.score.toLocaleString():'—'}</strong></div>
      <div><Clock3 size={19}/><span>RUNS LOGGED</span><strong>{entries.length}</strong></div>
    </div>
    <div className="leaderboard-toolbar">
      <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard views">
        <button role="tab" aria-selected={tab==='best'} className={tab==='best'?'selected':''} onClick={()=>setTab('best')}><Trophy size={15}/> TOP 10</button>
        <button role="tab" aria-selected={tab==='log'} className={tab==='log'?'selected':''} onClick={()=>setTab('log')}><Clock3 size={15}/> RUN HISTORY</button>
      </div>
      <button className="leaderboard-export" disabled={entries.length===0} onClick={onExport} title="Export all recorded runs as a CSV file"><Download size={15}/> EXPORT CSV</button>
    </div>
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        <thead><tr><th scope="col">{tab==='best'?'RANK':'#'}</th><th scope="col">OPERATIVE</th><th scope="col">SCORE</th><th scope="col">ACCURACY</th><th scope="col">SECTOR</th><th scope="col">RESULT</th>{tab==='log'&&<th scope="col">DATE</th>}</tr></thead>
        <tbody>{rows.map((entry,i)=><tr key={entry.id} className={entry.player.toLocaleLowerCase()===player.toLocaleLowerCase()?'my-score':''}>
          <td className="rank-number">{String(i+1).padStart(2,'0')}</td><td className="operative-name" title={entry.player}>{entry.player}</td>
          <td className="score-number">{entry.score.toLocaleString()}</td><td>{entry.accuracy}%</td><td>{entry.sectors}/{entry.totalSectors}</td>
          <td><span className={`result-chip ${entry.result}`}>{entry.result==='victory'?<ShieldCheck size={14}/>:<ShieldX size={14}/>} {entry.result==='victory'?'CLEARED':'FAILED'}</span></td>
          {tab==='log'&&<td className="date-cell">{readableTime(entry.playedAt)}</td>}
        </tr>)}</tbody>
      </table>
      {rows.length===0&&<div className="leaderboard-empty"><Trophy size={31}/><strong>NO RUNS LOGGED</strong><span>Enter a name and complete your first campaign attempt to join the board.</span></div>}
    </div>
    <div className="leaderboard-footer"><span>Scores are stored locally in this browser, not shared online. Training is unranked. Up to 150 runs are kept.</span>
      {!confirmClear?<button disabled={entries.length===0} onClick={()=>setConfirmClear(true)}><Trash2 size={14}/> CLEAR HISTORY</button>
        :<div className="clear-confirm"><span>Delete all scores?</span><button className="clear-yes" onClick={()=>{onClear();setConfirmClear(false);}}>DELETE</button><button onClick={()=>setConfirmClear(false)}>CANCEL</button></div>}
    </div>
  </div>;
}
