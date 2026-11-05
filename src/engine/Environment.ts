import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

export interface CoverPoint {
  id: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  route: THREE.Vector3[];
}

/** Every standing position is projected onto triangles from the original supplied GLB. */
export class Environment {
  readonly root: THREE.Group;
  readonly meshes: THREE.Mesh[] = [];
  readonly colliders: THREE.Mesh[] = [];
  readonly bounds = new THREE.Box3();
  readonly cover: CoverPoint[] = [];
  private down = new THREE.Raycaster();
  private line = new THREE.Raycaster();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(gltf: GLTF, scene: THREE.Scene) {
    this.root = gltf.scene;
    this.root.scale.setScalar(32); // 1.6× larger than v1.1: full original level enlarged, no replacement geometry.
    this.root.updateMatrixWorld(true);
    this.bounds.setFromObject(this.root);
    const center = this.bounds.getCenter(new THREE.Vector3());
    this.root.position.set(-center.x, -this.bounds.min.y, -center.z);
    this.root.updateMatrixWorld(true);
    this.bounds.setFromObject(this.root);
    this.root.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.receiveShadow = false;
        m.frustumCulled = true;
        this.meshes.push(m);
      }
    });
    scene.add(this.root);
    // Render materials/textures remain untouched. Non-rendered, double-sided
    // collision-only mesh proxies share the source geometry (no replacement models).
    for(const mesh of this.meshes){
      const collision=new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
      const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
      collision.userData.surface=material?.name??'concrete';
      collision.matrixAutoUpdate=false;
      collision.matrixWorld.copy(mesh.matrixWorld);
      collision.layers.set(1); // never rendered by the level's layer-0 camera
      this.colliders.push(collision);
    }
    this.down.layers.set(1);this.line.layers.set(1);

    // Surveyed on the ORIGINAL mesh: the playable courtyard/corridor is around
    // x=4.8..12.8, z=+12.8..-14.4; the corners of the full bounding box are NOT walkable.
    // Six linked cover stations surveyed on the supplied courtyard mesh. Every
    // transit follows existing walkable corridor points; no new level objects.
    const data:{x:number;z:number;waypoints:[number,number][]}[] = [
      {x:8, z:11.2, waypoints:[]},
      {x:9.6, z:8, waypoints:[[8.8,9.6]]},
      {x:11.2, z:4.8, waypoints:[[10.4,6.4]]},
      {x:11.2, z:1.6, waypoints:[[11.2,3.2]]},
      {x:11.2, z:-4.8, waypoints:[[11.2,0],[11.2,-1.6],[11.2,-3.2]]},
      {x:11.2, z:-8.8, waypoints:[[11.2,-6.4]]}
    ];
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      const foot = this.findStanding(p.x, p.z);
      if (!foot) throw new Error(`Cannot place cover ${i + 1} on supplied environment geometry`);
      const route = p.waypoints.map(([x, z]) => this.findStanding(x, z)).filter((v): v is THREE.Vector3 => !!v);
      route.push(foot.clone());
      this.cover.push({id: `COVER ${String(i + 1).padStart(2, '0')}`, position: foot,
        lookAt: foot.clone().add(new THREE.Vector3(0, 1.4, -5)), route});
    }
  }

  /** Find a surface with upward normal and a plausible height. Null means no safe floor. */
  floor(x: number, z: number, nearHeight = 0): number | null {
    this.down.set(new THREE.Vector3(x, 28, z), new THREE.Vector3(0, -1, 0));
    this.down.near = 0; this.down.far = 36;
    // Choose the surface nearest the walking height instead of the highest
    // floor/roof above it. Otherwise a camera may appear to "fly" up stairs or roofs.
    let best: number | null = null, error=Infinity;
    for(const hit of this.down.intersectObjects(this.colliders,false)){
      const normal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);
      if(!normal||normal.dot(this.up)<.55||hit.point.y<-.4||hit.point.y>3.9)continue;
      const difference=Math.abs(hit.point.y-nearHeight);
      if(difference<error){error=difference;best=hit.point.y;}
    }
    return best;
  }
  ground(x: number, z: number): number {
    const y = this.floor(x, z);
    return y === null ? Number.NaN : y + .035;
  }
  validFloor(x: number, z: number) {return this.floor(x, z) !== null;}
  findStanding(x: number, z: number): THREE.Vector3 | null {
    // Tight local search avoids inventing a floor where the mesh has none.
    for (const r of [0, .32, .64, .96, 1.28]) {
      for (let i = 0; i < (r === 0 ? 1 : 12); i++) {
        const a = i / 12 * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const y = this.floor(px, pz);
        if (y !== null && this.clearance(px, y, pz, .18)) return new THREE.Vector3(px, y + .035, pz);
      }
    }
    return null;
  }
  /** Raycast against the unchanged original meshes: walls obstruct both AI and shots. */
  obscured(start: THREE.Vector3, end: THREE.Vector3): boolean {
    const delta = end.clone().sub(start), length = delta.length();
    if (length < .12) return false;
    this.line.set(start, delta.normalize());
    this.line.near = .02; this.line.far = length - .02;
    return this.line.intersectObjects(this.colliders, false).length > 0;
  }
  private clearance(x: number, y: number, z: number, radius: number): boolean {
    const at = new THREE.Vector3(x, y + 1, z);
    for (const [dx, dz] of [[1,0], [-1,0], [0,1], [0,-1]]) {
      if (this.obscured(at, at.clone().add(new THREE.Vector3(dx * radius, 0, dz * radius)))) return false;
    }
    return true;
  }
  dispose(){for(const m of this.colliders)(m.material as THREE.Material).dispose();}
  walkable(from: THREE.Vector3, to: THREE.Vector3): boolean {
    if (!this.bounds.containsPoint(to.clone().add(new THREE.Vector3(0, 1, 0)))) return false;
    const floor = this.floor(to.x, to.z, from.y);
    if (floor === null || Math.abs(floor - from.y) > .68) return false;
    const a = from.clone().add(new THREE.Vector3(0, .9, 0));
    const b = new THREE.Vector3(to.x, floor + .9, to.z);
    return !this.obscured(a, b) && this.clearance(to.x, floor, to.z, .16);
  }
}
