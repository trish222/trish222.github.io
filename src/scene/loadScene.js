import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const base = import.meta.env.BASE_URL;

export async function loadScene(renderer, url = `${base}models/scene.glb`) {
  const ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  try {
    const { scene } = await loader.loadAsync(url);
    const named = new Map();
    scene.traverse((o) => { if (o.name) named.set(o.name, o); });
    return { scene, named };
  } finally {
    ktx2.dispose();
  }
}
