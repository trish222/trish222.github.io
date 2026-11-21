/* Nothing inside the still's <foreignObject> can reach the network, but
   the desktop is *made* of images (every icon, on the desktop, in a title
   bar, in the taskbar, on the Start button), and the boot screen of a web
   font; a still with holes or fallback type where they go is worse than
   no still at all. So they are fetched once, turned into `data:` URIs and
   kept: the set is small and fixed, and after the first still every one
   of them is a cache hit. */
const dataUrls = new Map();

async function dataUrl(src) {
  if (!dataUrls.has(src)) {
    const blob = await (await fetch(src)).blob();
    dataUrls.set(src, await new Promise((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = fail;
      r.readAsDataURL(blob);
    }));
  }
  return dataUrls.get(src);
}

export async function inlineImages(root) {
  await Promise.all([...root.querySelectorAll("img[src]")].map(async (img) => {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:")) return;
    try {
      img.setAttribute("src", await dataUrl(src));
    } catch {
      /* One icon that would not load is a gap in a bitmap shown for 1.6s;
         the rest of the still is still worth having. */
    }
  }));
}

export async function inlineFonts(css) {
  for (const url of new Set(css.match(/url\("?[^)"]+\.woff2"?\)/g) ?? [])) {
    try {
      css = css.replaceAll(url, `url("${await dataUrl(url.slice(4, -1).replaceAll('"', ""))}")`);
    } catch {
      /* A missing font falls back, as it would on the page. */
    }
  }
  return css;
}
