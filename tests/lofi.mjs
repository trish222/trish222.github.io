import assert from "node:assert/strict";
import { chromium } from "playwright";
import { CONTENT, CREDITS, UI } from "../src/content/content.js";

// The plain-HTML portfolio: ?lofi never starts the room (no model, no canvas), every window's content is on the
// page, the room's LO-FI link reaches it, and a browser without WebGL lands on it.
const base = process.argv[2] || "http://127.0.0.1:4320/";
const browser = await chromium.launch({ channel: "chromium" });
const noWebgl = () => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    return type.startsWith("webgl")
      ? null
      : getContext.call(this, type, ...args);
  };
};

// three.js and the scene are one chunk; a lo-fi visitor must never fetch it.
const watchScripts = (page) => {
  const scripts = [];
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") scripts.push(r.text());
  });
  return async () =>
    (await Promise.all(scripts)).filter((code) =>
      code.includes("WebGLRenderer"),
    ).length;
};

async function assertPortfolio(page, label) {
  await page.locator("#lofi").waitFor();
  const text = await page.locator("#lofi").innerText();
  const wanted = [
    CONTENT.owner.name,
    ...CONTENT.about,
    ...CONTENT.projects.flatMap((p) => [p.title, p.description]),
    ...CONTENT.contact.map((c) => c.text),
    ...CONTENT.resume.experience.map((e) => e.what),
    CREDITS.builtWith,
  ];
  for (const piece of wanted)
    assert.ok(text.includes(piece), `${label}: shows "${piece}"`);
  assert.deepEqual(
    await page.locator("#lofi .window-title").allInnerTexts(),
    UI.menuItems.map(([, t]) => t),
    `${label}: one window per menu entry`,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    `${label}: no horizontal scroll`,
  );
  const save = page.locator("#lofi-resume .resume-save");
  assert.equal(
    (await save.innerText()).trim(),
    UI.saveResume,
    `${label}: resume Save PDF button`,
  );
  assert.equal(await save.getAttribute("download"), "Trish-Nguyen-Resume.pdf");
  assert.equal(await save.getAttribute("href"), "/resume.pdf");
}

try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const sceneScripts = watchScripts(page);
    await page.goto(`${base}?lofi`);
    await assertPortfolio(page, `${width}px ?lofi`);
    assert.equal(
      await sceneScripts(),
      0,
      "no three.js or scene code is fetched",
    );
    assert.deepEqual(
      requests.filter((u) => /\.(glb|ktx2|hdr|exr)$/.test(u)),
      [],
      "no models or textures are fetched",
    );
    assert.equal(
      await page.evaluate(
        () => document.querySelector("#scene").offsetParent === null,
      ),
      true,
      "the canvas is not shown",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollHeight > innerHeight,
      ),
      "the page scrolls",
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}px ?lofi shows the whole portfolio with no 3D requests`,
    );
    await page.close();
  }

  const room = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await room.goto(`${base}?diagnostics=1`);
  await room.waitForFunction(() =>
    document.body.classList.contains("orbit-live"),
  );
  assert.equal(await room.locator("#lofi-link").innerText(), UI.lofi);
  await room.locator("#lofi-link").click();
  await assertPortfolio(room, "LO-FI link");
  await room.locator(".lofi-3d").click();
  await room.waitForFunction(
    () => !location.search.includes("lofi") && !document.getElementById("lofi"),
  );
  console.log("PASS the room links to lo-fi and lo-fi links back");
  await room.close();

  const fallback = await browser.newPage();
  await fallback.addInitScript(noWebgl);
  const fallbackScripts = watchScripts(fallback);
  await fallback.goto(base);
  await assertPortfolio(fallback, "no WebGL");
  assert.equal(
    await fallbackScripts(),
    0,
    "no WebGL: no three.js or scene code is fetched",
  );
  assert.equal(
    await fallback.locator(".lofi-3d").isVisible(),
    false,
    "no way back to a room that cannot run",
  );
  console.log("PASS no WebGL lands on lo-fi");
} finally {
  await browser.close();
}
