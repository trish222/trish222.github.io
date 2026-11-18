import * as THREE from 'three';
import { FLOPPIES } from '../content/content.js';

// The floppy_labels atlas: 3×2 cells of 512×384, row-major from the top-left, cell i on
// click_project_0i, a 70 px colour band on top (docs/scene-contract.md, "Floppy labels").
const CELL_W = 512, CELL_H = 384, BAND = 70, PAD = 36;
const FONT = '"Atkinson Hyperlegible"';

async function drawTitles() {
  await document.fonts.load(`700 80px ${FONT}`);
  const canvas = Object.assign(document.createElement('canvas'), { width: CELL_W * 3, height: CELL_H * 2 });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b1a22';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  FLOPPIES.forEach(({ title }, i) => {
    ctx.font = `700 80px ${FONT}`;
    const size = Math.min(80, 80 * (CELL_W - 2 * PAD) / ctx.measureText(title).width);
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillText(title, (i % 3 + 0.5) * CELL_W, Math.floor(i / 3) * CELL_H + (BAND + CELL_H) / 2);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.userData.titles = FLOPPIES.map((p) => p.title);
  return texture;
}

// Ink the titles over the blank atlas, on top of the baked material's own shader.
export async function labelFloppies(material) {
  const text = await drawTitles();
  const bake = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    bake(shader, renderer);
    shader.uniforms.labelText = { value: text };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D labelText;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 ink = texture2D(labelText, vMapUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, ink.a);`);
  };
  material.customProgramCacheKey = () => 'baked-labels';
  material.userData.labelText = text;
  return text;
}
