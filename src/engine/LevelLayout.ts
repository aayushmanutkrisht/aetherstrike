import type {EnemyKind} from './types';

/** All coordinates use the SAME supplied environment.glb (scale 32). No new models. */
export interface EnemyPlacement {x:number;z:number;kind:EnemyKind;}
export const ENCOUNTERS:EnemyPlacement[][] = [
  // Courtyard entry: pushed farther out for mid-range combat readability.
  [{x:6.8,z:5.7,kind:'standard'},{x:9.3,z:5.0,kind:'standard'},{x:11.8,z:4.4,kind:'armored'}],
  // North alley: enemies sit beyond the first bend.
  [{x:7.0,z:3.7,kind:'standard'},{x:10.2,z:2.8,kind:'standard'},
   {x:9.5,z:0.7,kind:'armored'},{x:11.6,z:1.4,kind:'heavy'}],
  // Mid courtyard: farther and more spread.
  [{x:8.7,z:0.1,kind:'standard'},{x:12.4,z:-0.2,kind:'armored'},
   {x:9.8,z:-1.5,kind:'standard'},{x:12.0,z:-2.4,kind:'heavy'}],
  // Central junction: long sightline with commander behind the line.
  [{x:8.5,z:-3.8,kind:'standard'},{x:12.5,z:-3.9,kind:'standard'},
   {x:9.6,z:-5.3,kind:'armored'},{x:8.5,z:-6.6,kind:'heavy'},
   {x:11.5,z:-7.4,kind:'priority'}],
  // Southern approach: six visible placements farther downrange.
  [{x:8.5,z:-8.7,kind:'standard'},{x:11.4,z:-8.8,kind:'armored'},
   {x:9.9,z:-9.8,kind:'standard'},{x:8.4,z:-10.9,kind:'heavy'},
   {x:11.3,z:-11.1,kind:'armored'},{x:9.9,z:-12.0,kind:'heavy'}],
  // Final defense: final wave pressed back toward the rear court.
  [{x:8.5,z:-12.7,kind:'standard'},{x:10.4,z:-12.8,kind:'armored'},
   {x:12.0,z:-12.9,kind:'heavy'},{x:10.1,z:-13.4,kind:'armored'},
   {x:11.0,z:-14.2,kind:'heavy'},{x:11.8,z:-15.0,kind:'priority'}]
];
