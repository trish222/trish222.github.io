// The Credits window. tests/credits.mjs checks it against art/credits.md; scripts/third-party-licenses.mjs
// writes the full text of each `libraries` license into dist/third-party-licenses.txt.
export const CREDITS = {
  inspiredBy: [
    { text: "seanaiux.com/computer", href: "https://seanaiux.com/computer" },
    { text: "felixrieseberg.com", href: "https://felixrieseberg.com" },
  ],
  assets: [
    {
      title: "old computer",
      author: "ivsn",
      license: "CC BY 4.0",
      href: "https://sketchfab.com/models/8183647717084f008969c22b7fcd1b8a",
    },
    {
      title: "CRT Computer Monitor",
      author: "fizyman",
      license: "CC BY 4.0",
      href: "https://sketchfab.com/3d-models/crt-computer-monitor-f2ff0013f86e4cd0a2aee183a23bdfee",
    },
    {
      title: "Desk lamp",
      author: "7ASSAN",
      license: "CC BY 4.0",
      href: "https://sketchfab.com/models/b9458e04d30e4b6284d46d35880a9b95",
    },
    {
      title: 'Verbatim Floppy Disk 3.5"',
      author: "Timescade",
      license: "CC BY 4.0",
      href: "https://sketchfab.com/models/f055312452cb4b5f87898a9beb312cbe",
    },
    {
      title: "Ice Coffee",
      author: "ponchoguy",
      license: "CC BY 4.0",
      href: "https://sketchfab.com/models/fd2e9142168d4f31ba99bf4d9b1165b4",
    },
    {
      title: "Coffee Mug (School Project)",
      author: "FrenchBaguette",
      license: "CC BY 4.0",
      href: "https://sketchfab.com/models/5f5ccee1514c440887c072fae8e0d699",
    },
  ],
  // CC0 needs no attribution; listed as a courtesy.
  cc0: [
    { title: "Wooden Table 01", author: "Ethan Place", href: "https://polyhaven.com/a/WoodenTable_01" },
    { title: "Painted Plaster Wall", author: "Amal Kumar", href: "https://polyhaven.com/a/painted_plaster_wall" },
    { title: "Plank Flooring 04", author: "Dimitrios Savva", href: "https://polyhaven.com/a/plank_flooring_04" },
    { title: "Book Encyclopedia Set 01", author: "John Malcolm", href: "https://polyhaven.com/a/book_encyclopedia_set_01" },
    { title: "Office Notepads", author: "Ulan Cabanilla", href: "https://polyhaven.com/a/office_notepads" },
    { title: "Stationery Supplies", author: "Mateusz Sadek", href: "https://polyhaven.com/a/stationery_supplies" },
    { title: "Shanghai Bund", author: "Greg Zaal", href: "https://polyhaven.com/a/shanghai_bund" },
  ],
  fonts: [
    {
      title: "Atkinson Hyperlegible",
      author: "Braille Institute",
      license: "SIL OFL 1.1",
      href: "https://brailleinstitute.org/freefont",
    },
    {
      title: "Departure Mono",
      author: "Helena Zhang",
      license: "SIL OFL 1.1",
      href: "https://departuremono.com",
    },
    {
      title: "Martian Mono",
      author: "Evil Martians",
      license: "SIL OFL 1.1",
      href: "https://github.com/evilmartians/mono",
    },
    {
      title: "RX100",
      author: "Anurag Gautam, Indian Type Foundry",
      license: "ITF FFL 2.0",
      href: "https://www.fontshare.com/fonts/rx-100",
    },
    {
      title: "Playfair Display",
      author: "Claus Eggers Sørensen",
      license: "SIL OFL 1.1",
      href: "https://fonts.google.com/specimen/Playfair+Display",
    },
    {
      title: "Liberation Serif",
      author: "Red Hat, Inc.",
      license: "SIL OFL 1.1",
      href: "https://github.com/liberationfonts/liberation-fonts",
    },
    {
      title: "Cinzel",
      author: "Natanael Gama",
      license: "SIL OFL 1.1",
      href: "https://fonts.google.com/specimen/Cinzel",
    },
  ],
  libraries: [
    { title: "three.js", author: "three.js authors", license: "MIT", href: "https://threejs.org" },
    { title: "postprocessing", author: "Raoul van Rüschen", license: "Zlib", href: "https://github.com/pmndrs/postprocessing" },
    { title: "GSAP", author: "GreenSock", license: "GSAP Standard License", href: "https://gsap.com" },
    { title: "meshoptimizer", author: "Arseny Kapoulkine", license: "MIT", href: "https://github.com/zeux/meshoptimizer" },
    { title: "Basis Universal", author: "Binomial LLC", license: "Apache-2.0", href: "https://github.com/BinomialLLC/basis_universal" },
    { title: "98.css", author: "Jordan Scales", license: "MIT", href: "https://github.com/jdan/98.css" },
    { title: "Tailwind CSS", author: "Tailwind Labs, Inc.", license: "MIT", href: "https://tailwindcss.com" },
    { title: "Vite", author: "VoidZero Inc. and Vite contributors", license: "MIT", href: "https://vite.dev" },
  ],
  builtWith: "Built with Blender, Three.js and Vite.",
};
