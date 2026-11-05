import * as THREE from 'three';
import {GLTF,GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

export const ASSET_PATHS={environment:'assets/environment.glb',enemy:'assets/enemy(1).glb',weapon:'assets/first person view.glb'} as const;
export type AssetKey=keyof typeof ASSET_PATHS;
/** Centralized cache. No replacement geometry or remote asset service is used. */
export class AssetManager {
  private loader=new GLTFLoader(); private cache=new Map<AssetKey,Promise<GLTF>>();
  load(key:AssetKey):Promise<GLTF>{
    if(!this.cache.has(key))this.cache.set(key,new Promise((resolve,reject)=>{
      this.loader.load(`${import.meta.env.BASE_URL}${ASSET_PATHS[key]}`,resolve,undefined,reject);
    }));
    return this.cache.get(key)!;
  }
  async all(onProgress?:(pct:number,asset:string)=>void){
    const out={} as Record<AssetKey,GLTF>; let done=0;
    for(const key of ['environment','weapon'] as AssetKey[]){out[key]=await this.load(key);onProgress?.(++done/2*100,key);}
    return out;
  }
  async instantiate(key:AssetKey):Promise<THREE.Group>{return clone((await this.load(key)).scene) as THREE.Group;}
  clear(){this.cache.clear();}
}
