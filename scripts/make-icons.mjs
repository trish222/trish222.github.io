/*
  PLACEHOLDER DESKTOP ICONS

  Writes public/icons/*.png. These are stand-ins for Trish's own pixel
  art — deliberately plain, deliberately ours. No third-party artwork
  goes in here: the project rules rule out Microsoft's icons, and an
  emoji set (what the desktop used before) is a font, not art, so it
  reads as whatever the visitor's OS happens to draw.

  Drawn from primitives for the same reason the 3D machine is: a
  checked-in binary with no source is a dead end, and at 32x32 every
  pixel is placed by this file rather than by a resampler. Edit a recipe
  and `npm run icons` to redraw.

  No dependencies. PNG is a zlib stream plus three chunks, which is
  about forty lines with node:zlib doing the hard part.
*/
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const SIZE = 32;

/* ==========================================
   PALETTE

   The Win95 system sixteen plus the few tints the shapes need. Keeping
   to a short list is most of what makes a set look like a set.
   ========================================== */
const PAL = {
  ".": null,              // transparent
  k: "#000000",           // outline
  d: "#404040",           // shadow
  g: "#808080",           // mid grey
  s: "#c0c0c0",           // silver
  w: "#ffffff",           // white
  y: "#ffd24c",           // folder face
  Y: "#d9a128",           //   and its shadow side
  b: "#000080",           // navy
  l: "#3a6ea5",           // lighter blue
  t: "#008080",           // desktop teal
  n: "#10b06a",           // recycle green
};

/* ==========================================
   A 32x32 CANVAS AND THE FEW SHAPES IT NEEDS
   ========================================== */
function canvas() {
  const px = new Array(SIZE * SIZE).fill(".");
  const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;

  const api = {
    px,
    set(x, y, c) {
      if (inside(x, y)) px[y * SIZE + x] = c;
      return api;
    },
    /* Inclusive on both corners: these are pixels, not boxes. */
    rect(x0, y0, x1, y1, c) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) api.set(x, y, c);
      return api;
    },
    frame(x0, y0, x1, y1, c) {
      for (let x = x0; x <= x1; x++) { api.set(x, y0, c); api.set(x, y1, c); }
      for (let y = y0; y <= y1; y++) { api.set(x0, y, c); api.set(x1, y, c); }
      return api;
    },
    hline(x0, x1, y, c) { return api.rect(x0, y, x1, y, c); },
    vline(x, y0, y1, c) { return api.rect(x, y0, x, y1, c); },
    /* Both edges walk linearly from the top row to the bottom row, which
       is every tapered thing here: a bin, a pair of shoulders, a lid. */
    taper(y0, y1, topL, topR, botL, botR, c) {
      const span = Math.max(1, y1 - y0);
      for (let y = y0; y <= y1; y++) {
        const t = (y - y0) / span;
        const l = Math.round(topL + (botL - topL) * t);
        const r = Math.round(topR + (botR - topR) * t);
        api.hline(l, r, y, c);
      }
      return api;
    },
    disc(cx, cy, r, c) {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r + r * 0.4) api.set(cx + x, cy + y, c);
        }
      }
      return api;
    },
    /* Traces the outside of everything already drawn, so a shape and its
       outline cannot drift apart. */
    outline(c) {
      const copy = px.slice();
      const solid = (x, y) => inside(x, y) && copy[y * SIZE + x] !== ".";
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (solid(x, y)) continue;
          if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
            api.set(x, y, c);
          }
        }
      }
      return api;
    },
  };
  return api;
}

/* ==========================================
   THE FIVE (AND THE START MARK)
   ========================================== */
const ICONS = {
  /* A folder, tab to the left, lit from the top. */
  "projects": () => {
    const c = canvas();
    c.rect(3, 6, 13, 9, "y");            // tab
    c.rect(2, 9, 29, 26, "y");           // body
    c.hline(2, 29, 9, "w");              // top highlight
    c.hline(3, 13, 6, "w");
    c.rect(2, 24, 29, 26, "Y");          // the face turning away at the base
    c.vline(29, 9, 26, "Y");
    return c.outline("k");
  },

  /* Head and shoulders on a card — a user, not a person in particular. */
  "about-me": () => {
    const c = canvas();
    c.rect(4, 3, 27, 28, "w");           // the card
    c.frame(4, 3, 27, 28, "s");
    c.disc(16, 12, 5, "l");              // head
    c.taper(18, 25, 12, 20, 7, 25, "l"); // shoulders
    c.disc(16, 12, 3, "b");              // a shade of depth on both
    c.taper(20, 25, 13, 19, 9, 23, "b");
    return c.outline("k");
  },

  /* A sheet with a folded corner and ruled lines. */
  "resume": () => {
    const c = canvas();
    c.rect(6, 2, 25, 29, "w");
    c.rect(19, 2, 25, 8, ".");           // the corner that is folded back
    c.taper(2, 8, 19, 19, 19, 25, "w");
    c.rect(19, 2, 25, 8, "s");           // ...and the fold itself
    c.taper(2, 8, 26, 26, 20, 26, ".");
    for (let i = 0; i < 6; i++) {        // ruled lines, the first indented
      const y = 12 + i * 3;
      c.hline(i === 0 ? 13 : 9, i === 5 ? 18 : 22, y, "g");
    }
    c.hline(9, 16, 6, "b");              // a name across the top
    c.hline(9, 13, 8, "b");
    return c.outline("k");
  },

  /* An envelope, flap closed. */
  "contact": () => {
    const c = canvas();
    c.rect(2, 7, 29, 25, "w");
    for (let i = 0; i <= 13; i++) {      // the flap, drawn as two diagonals
      c.set(2 + i, 7 + i, "g");
      c.set(29 - i, 7 + i, "g");
      c.set(2 + i, 8 + i, "s");
      c.set(29 - i, 8 + i, "s");
    }
    c.rect(2, 23, 29, 25, "s");          // the lip at the base
    return c.outline("k");
  },

  /* A bin: tapered body, ridged, with a lid and a recycle mark. */
  "recycle-bin": () => {
    const c = canvas();
    c.taper(9, 28, 6, 25, 10, 21, "s");  // body
    c.rect(4, 5, 27, 8, "s");            // lid
    c.rect(13, 2, 18, 4, "s");           // handle
    for (let x = 10; x <= 21; x += 4) {  // ridges
      c.taper(11, 26, x, x, x + 2, x + 2, "g");
    }
    c.hline(4, 27, 5, "w");
    c.rect(13, 13, 18, 21, "n");         // the mark
    c.rect(14, 15, 17, 19, "s");
    return c.outline("k");
  },

  /* The Start button's mark. A little CRT rather than anything
     flag-shaped — the machine the whole site is set inside, and
     nothing anyone else owns. */
  "start": () => {
    const c = canvas();
    c.rect(3, 5, 28, 23, "s");           // the shell
    c.rect(6, 8, 25, 19, "t");           // the picture
    c.hline(6, 25, 10, "#1aa3a3");       // one bright scanline
    c.hline(6, 25, 15, "#1aa3a3");
    c.rect(12, 24, 19, 26, "s");         // the stand
    c.rect(8, 27, 23, 29, "s");
    return c.outline("k");
  },
};

/* ==========================================
   PNG
   ========================================== */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPng(px) {
  /* Filter byte 0 (none) in front of every scanline: these are tiny and
     flat, so deflate has plenty to work with either way. */
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[p++] = 0;
    for (let x = 0; x < SIZE; x++) {
      const hex = PAL[px[y * SIZE + x]] ?? px[y * SIZE + x];
      if (!hex || hex === ".") { p += 4; continue; } // transparent: 0,0,0,0
      raw[p++] = parseInt(hex.slice(1, 3), 16);
      raw[p++] = parseInt(hex.slice(3, 5), 16);
      raw[p++] = parseInt(hex.slice(5, 7), 16);
      raw[p++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, draw] of Object.entries(ICONS)) {
  const png = toPng(draw().px);
  writeFileSync(join(OUT, `${name}.png`), png);
  console.log(`${name}.png`.padEnd(20), `${png.length} bytes`);
}
