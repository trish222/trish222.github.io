// Browser-only experiments, served by Vite. Never imported by the application.
import * as THREE from 'three';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';

export const stages = {
  best: [
    { name: 'baseline' },
    { name: 'efficient', aoScale: .5, samples: 12 },
    { name: 'sharp', aoScale: .375, samples: 12, dpr: 2 },
    { name: 'foundation', aoScale: .375, samples: 12, dpr: 2, targeted: .5, hemi: 15, moon: 2.6, normal: 512, plastic: true },
    { name: 'foundation175', aoScale: .75 / 1.75, samples: 12, dpr: 1.75, targeted: .5, hemi: 15, moon: 2.6, normal: 512, plastic: true },
  ],
  refine: [
    { name: 'baseline' },
    { name: 'ao05-12', aoScale: .5, samples: 12 },
    { name: 'ao05-12-pd2', aoScale: .5, samples: 12, pdRadius: 2 },
    { name: 'ao05-12-pd3', aoScale: .5, samples: 12, pdRadius: 3 },
    { name: 'ao05-12-dpr175', aoScale: .5, samples: 12, dpr: 1.75 },
    { name: 'ao05-12-dpr2', aoScale: .5, samples: 12, dpr: 2 },
    { name: 'ssao16-half', aoScale: .5, ssao: true },
  ],
  ao: [
    { name: 'baseline' },
    { name: 'samples12', samples: 12 },
    { name: 'ao075', aoScale: .75 },
    { name: 'ao05', aoScale: .5 },
    { name: 'ao05-12', aoScale: .5, samples: 12 },
    { name: 'ao05-dpr175', aoScale: .5, dpr: 1.75 },
    { name: 'ao05-dpr2', aoScale: .5, dpr: 2 },
    { name: 'ao05-msaa2', aoScale: .5, msaa: 2 },
    { name: 'ssao16', aoScale: .5, ssao: true },
    { name: 'contacts-only', ao: false },
  ],
  light: [
    { name: 'baseline', aoScale: .5 },
    { name: 'fill15', aoScale: .5, hemi: 15 },
    { name: 'room-env008', aoScale: .5, env: .08 },
    { name: 'room-env02', aoScale: .5, env: .2 },
    { name: 'balanced', aoScale: .5, env: .2, hemi: 15, moon: 2.6 },
  ],
  reflections: [
    { name: 'baseline', aoScale: .5, samples: 12 },
    { name: 'targeted02', aoScale: .5, samples: 12, targeted: .2 },
    { name: 'targeted05', aoScale: .5, samples: 12, targeted: .5 },
    { name: 'targeted-balanced', aoScale: .5, samples: 12, targeted: .5, hemi: 15, moon: 2.6 },
  ],
  material: [
    { name: 'baseline', aoScale: .5, samples: 12 },
    { name: 'plastic-relief', aoScale: .5, samples: 12, plastic: true },
    { name: 'wood-relief', aoScale: .5, samples: 12, wood: true },
    { name: 'wood-normal512', aoScale: .5, samples: 12, normal: 512 },
    { name: 'wood-normal1k', aoScale: .5, samples: 12, normal: 1024 },
  ],
};

export async function install() {
  const scene = window.__scene, camera = window.__camera, composer = window.__composer;
  const renderer = composer.renderer, gtao = composer.passes.find(p => p.gtaoMaterial);
  const originalPasses = [...composer.passes];
  const saved = new Map();
  scene.traverse(o => {
    for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
      if (!saved.has(m)) saved.set(m, { bumpScale: m.bumpScale, bumpMap: m.bumpMap,
      roughness: m.roughness, metalness: m.metalness, envMap: m.envMap,
      normalMap: m.normalMap, normalScale: m.normalScale?.clone(), envMapIntensity: m.envMapIntensity });
    }
  });
  let environment;
  let ssao;
  const normals = new Map();
  for (const size of [512, 1024]) {
    const base = await new THREE.TextureLoader().loadAsync(`/.review-artifacts/foundation/wood-normal-${size === 1024 ? '1k' : '512'}.jpg`);
    const maps = new Map();
    for (const [m, initial] of saved) {
      if (!initial.bumpMap?.image?.src?.includes('desk-wood')) continue;
      const map = initial.bumpMap.clone();
      map.source = base.source; map.needsUpdate = true;
      maps.set(m, map);
    }
    normals.set(size, maps);
  }
  function makeEnvironment() {
    const hidden = scene.children.filter(o => !o.isLight && !o.isDirectionalLight && o.name !== 'desk');
    // Keep the room shell and joinery, but exclude close props/self-reflections.
    const room = scene.getObjectByName('room');
    const objects = hidden.filter(o => o !== room);
    const visibility = objects.map(o => o.visible);
    const computer = scene.getObjectByName('computer');
    const position = computer.position.clone().add(new THREE.Vector3(0, 4, 0));
    const pmrem = new THREE.PMREMGenerator(renderer);
    try {
      objects.forEach(o => { o.visible = false; });
      environment = pmrem.fromScene(scene, 0, .1, 120, { size: 128, position });
    } finally {
      objects.forEach((o,i) => { o.visible = visibility[i]; });
      pmrem.dispose();
    }
  }
  return {
    configure(v) {
      const ratio = v.dpr ?? 1.5;
      renderer.setPixelRatio(ratio); composer.setPixelRatio(ratio);
      composer.passes = [...originalPasses];
      gtao.enabled = v.ao !== false;
      gtao.updateGtaoMaterial({ samples: v.samples ?? 24 });
      gtao.updatePdMaterial({ radius: v.pdRadius ?? 4 });
      gtao.setSize(Math.round(innerWidth * ratio * (v.aoScale ?? 1)), Math.round(innerHeight * ratio * (v.aoScale ?? 1)));
      for (const target of [composer.renderTarget1, composer.renderTarget2]) {
        if (target.samples !== (v.msaa ?? 0)) { target.dispose(); target.samples = v.msaa ?? 0; }
      }
      if (v.ssao) {
        ssao ??= new SSAOPass(scene, camera, 720, 450, 16);
        ssao.kernelRadius = 8; ssao.minDistance = .001; ssao.maxDistance = .025;
        ssao.setSize(Math.round(innerWidth * ratio * .5), Math.round(innerHeight * ratio * .5));
        composer.passes[1] = ssao;
      }
      scene.environment = null;
      window.__lights({ hemi: 19, moon: 2.2, env: 0 });
      if (v.env) {
        if (!environment) makeEnvironment();
        scene.environment = environment.texture;
      }
      window.__lights({ hemi: v.hemi ?? 19, moon: v.moon ?? 2.2, env: v.env ?? 0 });
      // __lights renders through the app, which restores the policy. Reset the
      // experiment resolution afterward while app scheduling remains frozen.
      renderer.setPixelRatio(ratio); composer.setPixelRatio(ratio);
      gtao.setSize(Math.round(innerWidth * ratio * (v.aoScale ?? 1)), Math.round(innerHeight * ratio * (v.aoScale ?? 1)));
      if (v.ssao) ssao.setSize(Math.round(innerWidth * ratio * .5), Math.round(innerHeight * ratio * .5));
      for (const [m, initial] of saved) { Object.assign(m, initial); m.needsUpdate = true; }
      if (v.targeted) {
        if (!environment) makeEnvironment();
        for (const name of ['computer', 'desk']) scene.getObjectByName(name).traverse(o => {
          const m = o.material;
          if (!m?.isMeshStandardMaterial || saved.get(m).envMap) return;
          m.envMap = environment.texture;
          m.envMapIntensity = saved.get(m).envMapIntensity * v.targeted;
          m.needsUpdate = true;
        });
      }
      if (v.plastic) scene.getObjectByName('computer').traverse(o => {
        if (o.material?.isMeshStandardMaterial && o.material.bumpMap) o.material.bumpScale = .002;
      });
      if (v.wood) scene.getObjectByName('desk').traverse(o => {
        if (o.material?.bumpMap) o.material.bumpScale = .004;
      });
      if (v.normal) for (const [m, map] of normals.get(v.normal)) {
        m.bumpMap = null; m.normalMap = map; m.normalScale = new THREE.Vector2(.25, .25); m.needsUpdate = true;
      }
      return { ratio, aoSize: [gtao.width, gtao.height], env: !!scene.environment };
    },
    dispose() { environment?.dispose(); ssao?.dispose(); for (const maps of normals.values()) for (const map of maps.values()) map.dispose(); },
  };
}
