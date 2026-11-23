import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { usesMobileScene } from '../config/experience.js';

const base = import.meta.env.BASE_URL;
const LIGHTMAPS = ['lightmap_lampOn', 'lightmap_lampOff', 'lightmap_screen'];

// glTF has no lightmap slot, so the lightmaps ship as named, unreferenced images.
// Islands sit 2 texels apart, so sample level 0 only: lower mips bleed islands together.
async function loadLightmaps(parser, ktx2) {
  const entries = await Promise.all(LIGHTMAPS.map(async (name) => {
    const index = parser.json.images.findIndex((image) => image.name === name);
    if (index < 0) throw new Error(`${url} is missing the "${name}" image`);
    const texture = await parser.loadImageSource(index, ktx2);
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return [name, texture];
  }));
  return Object.fromEntries(entries);
}

export async function loadScene(renderer, onProgress, url = `${base}models/${usesMobileScene() ? 'scene-mobile' : 'scene'}.glb`) {
  const ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  try {
    const { scene, parser } = await loader.loadAsync(url, onProgress);
    const lightmaps = await loadLightmaps(parser, ktx2);
    const named = new Map();
    scene.traverse((o) => { if (o.name) named.set(o.name, o); });
    return { scene, named, lightmaps, extras: scene.userData };
  } finally {
    ktx2.dispose();
  }
}
