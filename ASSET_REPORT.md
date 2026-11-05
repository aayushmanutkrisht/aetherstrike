# AETHER STRIKE — Verified Asset Report

**Inspection method:** Direct decoding of glTF 2.0 JSON/BIN inside the three original user-supplied GLB files, mesh accessor triangle counts, node transforms, skeleton joint references and animation sampler timestamps. Runtime floor and line-of-sight placement was additionally sampled against the supplied environment's actual triangles. Full machine-readable results: `asset_analysis.json`; raw data extraction script: `tools/inspect_assets.py`. **No clips were inferred or downloaded.**

## Inventory

| Parameter | Environment | Soldier | First-person arms + weapon |
| --- | --- | --- | --- |
| Filename | `environment.glb` | `enemy.glb` | `first person view.glb` |
| Format | Binary glTF 2.0 | Binary glTF 2.0 | Binary glTF 2.0 |
| Bytes | 19,222,148 | 25,472,068 | 7,946,052 |
| Meshes/instances | 9 / 9 | 23 / 23 | 13 / 13 |
| Triangles | 24,742 | 84,154 | 25,103 |
| Material count | 9 | 10 | 3 |
| Texture images | 10, all embedded | 24, all embedded | 7, all embedded |
| Skin count | 0 | 1 | 1 |
| Joints in skin | — | 114 | 50 |
| Named animation clips | 0 | 1 | 1 |
| Source dimensions (X×Y×Z) | 2.216×0.417×2.660 | 110.904×53.467×179.583 | 1.637×0.666×2.691 |

All dimensions are measured from source node transforms in **source units**, not meters. Scale is not assumed from GLB metadata.

## A. First-person arms and gun

- **Asset:** `public/assets/first person view.glb`.
- **Material names:** `carbine`, `lens`, `arms`.
- **Parts:** Named weapon nodes include `carbine`, `base`, `scope`, `lens`, `lid`, `handle`, `handle2`, `bolt`, `boltcatch`, `release`, `clip`, `bullet`, `trigger`. The arms belong to a separate skinned mesh (`Object_84`). The gun and arms are not one inseparable mesh.
- **Rig:** 50 joints. Partial hierarchy: `_rootJoint → Joint_00 → L_arm_01 → L_elbow_02 → L_wrist_03 → fingers`; the other branch includes `R_arm_025 → R_elbow_026 → R_wrist_027 → fingers`. Full joint names/hierarchy references are in `asset_analysis.json`.
- **Available clip, exhaustive:** `allanims` — **7.40 s**, **69 animation channels**. This is one general clip; it is **not** verified to provide distinct standalone shooting, reload, ADS or recoil takes. Its animated target list includes weapon component objects such as the lid/handles.
- **Independent animation:** Component nodes such as `clip` and `bolt` have their own object transforms; they are animated procedurally. The skinned arms preserve their supplied skeleton and remain parented with the weapon while the whole rig is moved for coordinated recoil, ADS, sway and reloading.
- **Runtime transformation:** 0.39× uniform scale (v1.3 weapon presentation) and +π camera-space yaw; the original barrel extends along source +Z and must be aimed toward camera -Z. The barrel tip was sampled at approximately source `(0, 0.318, 1.366)`, giving a muzzle marker near local `(0, 0.124, -0.533)` after conversion. The actual meshes, material properties, texture maps and proportions remain unchanged.
- **Visual caveat:** Despite the requested LMG gameplay, this supplied weapon is named as a **carbine** in the mesh and material. The source model is deliberately retained; it is not silently replaced with a generic LMG.
- **Runtime suitability:** 25k triangles plus 7 embedded texture images is reasonable for one first-person viewmodel. Dedicated rig animation polish would need manual authoring, but is not required to fire or reload.

## B. Soldier

- **Asset:** `public/assets/enemy.glb`.
- **Materials:** Ten authored materials include head/helmet, gloves, armor plate, pouches, boots, trousers and eyewear.
- **Rig:** One 114-joint skeleton; representative body hierarchy: `_rootJoint → RL_BoneRoot_00 → CC_Base_Hip_01 → CC_Base_Pelvis_02 → CC_Base_L_Thigh_03 → CC_Base_L_Calf_04 → CC_Base_L_Foot_05`. Full hierarchy entries are in the JSON inspection report.
- **Available clips, exhaustive:** **`Mark_Idle_Pose` — 16.63 s**, **321 channels**. No separately named walking, shooting, damage, alert, crouching or death clips are present.
- **Runtime transformation:** Original model's long -Z vertical dimension is rotated X = +π/2, then uniformly scaled by **0.009** so its height is about **1.84 world units**. Foot position is projected onto original environment triangles; model origin remains at standing height.
- **AI behavior:** The supplied idle clip plays with Three.js `AnimationMixer`; walking leg offsets, hit flinches, death tilt, aim rotation and combat state timing are procedural. **No incompatible or unverified motion clip is assigned.**
- **Variations:** Three other combat roles reuse `SkeletonUtils.clone` of the supplied rig, with minor tints and distinct hit points, fire rates and combat behaviors. The source materials remain unchanged; modified instances use cloned materials.
- **Runtime suitability:** One clone is ~84k triangles, with 24 embedded images. Three live soldiers per encounter is feasible as a target on capable desktop hardware but may be GPU-memory intensive. Reduce concurrent NPC count or optimize textures if benchmarking shows pressure.

## C. Environment

- **Asset:** `public/assets/environment.glb`.
- **Content:** Nine mesh definitions and nine mesh instances. There is a large architectural/background mesh (17,698 triangles) plus eight additional sections; the geometry is not pre-labeled with game collision or navigation data. Materials include `Ground_0`, brick, plaster, concrete and dust textures.
- **Skeletons and clips:** None.
- **Source bounds:** X -0.950..1.267, Y 0.551..0.968, Z -1.476..1.185.
- **Runtime transformation:** 32× uniform scale (v1.3 environment enlargement), then translated to horizontally center the overall source bounds and place the lowest point at y=0. Bounding volume is about **70.93×13.34×85.15 world units**.
- **Walkability:** Much of the overall bounding box contains background architecture or empty space. Real upward-facing standing surfaces suitable for the first mission were surveyed around x≈4.8..12.8, z≈12.8..-14.4. The initial oversized coordinates had no ground beneath them and were **replaced**, not patched with floating invisible platforms.
- **Cover stations (x,z):** `(5,7)`, `(7,1)`, `(7,-5.5)`; foot height is calculated by a downward raycast on the original model.
- **Station routes:** Station 1→2 uses `(5.5,6) → (6,5) → (6.5,4) → (7,3) → (7,2) → (7,1)`. Station 2→3 uses `(7,0) → (7,-1) → (7,-2) → (7,-3) → (7,-4) → (7,-5.5)`. The camera moves continuously and is raised/lowered to follow real ground height.
- **Collisions:** Every original mesh is reused as invisible, double-sided raycast collision geometry sharing its source vertices. No visible replacement scene is created. Geometry checks include floor normal, valid height, body-level wall clearance and enemy line of sight. Full navmesh/pathfinding has not been implemented.
- **Encounter markers:** Nine soldiers across three sequential squads, with local relocation if a surveyed candidate is obstructed by real walls.
- **Runtime suitability:** Environment polygon count is reasonable; 10 embedded textures may require texture/memory optimization after actual browser profiling.

## Missing source assets / animations

- No dedicated weapon ADS, idle, full-auto, chamber, reload or recoil clips; procedural transforms are used.
- No soldier patrol, run, combat-fire, take-cover, suppression, hit, defeated or transition clips; only the verified idle clip is used, supplemented with procedural states.
- No separate 3D LMG asset beyond the supplied carbine, and none added.
- No authored gun sounds, ambient audio, soldier voice, impacts or explosions; replaceable Web Audio effects are supplied.
- No provided navigation mesh, cover metadata, collision proxy authoring or campaign map definition; the first mission is authored over the existing mesh.
- No custom third-person player body was supplied; autonomous movement uses the first-person camera and the existing first-person arms.

## Next asset work, if higher animation fidelity is desired

Use Blender or another compatible editor to create **only** the missing soldier firing, locomotion and death clips on the **existing** 114-joint skeleton. Export them into the existing soldier GLB without changing its skin hierarchy. Verify clips/pose bases in a browser before adding the mixer actions. For the viewmodel, isolate compatible timing from `allanims` only after manually inspecting its pose progression; until then, keep deterministic root-level transforms and named component motions.

### v1.3 camera and visual corrections

- Player eye is **1.03 world units above the projected floor**, measured at each cover point.
- The original environment is now uniformly enlarged **32×** (1.6× the previous 20× runtime scale), and all gameplay waypoints and enemy anchors have been transformed by 1.6× to stay on its real ground.
- The existing soldier GLB is displayed at **0.009×** its source size, and the original arms/weapon GLB at **0.39×**. No GLB bytes or materials were modified.
- The first-person barrel tip is aligned to the transformed original geometry, not a substitute weapon.
